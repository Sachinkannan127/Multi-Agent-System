import os
import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import litellm

from app.core.config import settings

logger = logging.getLogger("app.routes.code_visualizer")
router = APIRouter(prefix="/code", tags=["Code Visualizer"])


class LineStep(BaseModel):
    step_number: int = Field(..., description="Sequential step index in execution trace (1-indexed)")
    line_number: int = Field(..., description="1-indexed line number in the source code")
    code: str = Field(..., description="Source code text of this line")
    explanation: str = Field(..., description="Clear, plain-English explanation of what happens on this line")
    mechanics: str = Field(..., description="Under-the-hood execution mechanics (memory, conditions, assignments)")
    variables: Dict[str, Any] = Field(default_factory=dict, description="Active variable state dictionary at this step")
    modified_vars: List[str] = Field(default_factory=list, description="Variables created or mutated in this step")
    call_stack: List[str] = Field(default_factory=lambda: ["global()"], description="Current call stack frame hierarchy")
    edge_cases: Optional[str] = Field(None, description="Potential edge cases or bugs related to this line")
    time_complexity: Optional[str] = Field(None, description="Time complexity note for this operation")


class CodeAnalysisRequest(BaseModel):
    code: str = Field(..., description="The source code program to analyze and visualize")
    language: Optional[str] = Field("python", description="Programming language (e.g., python, javascript, cpp, java)")
    mode: Optional[str] = Field("step_by_step", description="Mode: 'step_by_step' or 'full_breakdown'")


class CodeAnalysisResponse(BaseModel):
    title: str
    language: str
    total_lines: int
    total_steps: int
    overview: str
    time_complexity_overall: str
    space_complexity_overall: str
    steps: List[LineStep]
    line_explanations: Dict[int, str] = Field(
        default_factory=dict,
        description="Map of line_number -> detailed explanation for static line view"
    )


VISUALIZER_PROMPT_TEMPLATE = """You are an elite Computer Science Professor and Code Execution Visualizer engine.
Analyze the following {language} code program and generate a rich, step-by-step visual execution trace and line-by-line explanation.

Code to analyze:
```{language}
{code}
```

Instructions:
1. Break down the code execution step-by-step (simulating how the runtime/interpreter executes it line-by-line).
2. For each execution step, provide:
   - `step_number`: 1, 2, 3...
   - `line_number`: exact 1-indexed line in the source code
   - `code`: the actual line of code
   - `explanation`: clear, simple, crystal-clear explanation of what happens on this step
   - `mechanics`: under-the-hood details (e.g., variable assignment, condition check evaluated to True/False, function stack frame pushed, return value)
   - `variables`: a JSON object of current variables and their values at this step (e.g., {{"n": 5, "result": 120, "i": 2}})
   - `modified_vars`: list of variable names updated or created at this step (e.g., ["result", "i"])
   - `call_stack`: list of call frames (e.g., ["<global>", "factorial(n=5)"])
   - `edge_cases`: any common gotchas, off-by-one errors, or potential pitfalls for this line
   - `time_complexity`: runtime note for this operation (e.g., O(1), O(log n))
3. Also provide a static `line_explanations` map where key is line_number (as string or int) and value is the line's purpose.
4. Provide an overall summary `overview`, `time_complexity_overall`, `space_complexity_overall`, and a descriptive `title`.

Return strictly valid JSON matching this schema:
{{
  "title": "Algorithm / Program Title",
  "language": "{language}",
  "total_lines": <int>,
  "total_steps": <int>,
  "overview": "Comprehensive high-level summary of what this code does and its algorithmic approach.",
  "time_complexity_overall": "O(...)",
  "space_complexity_overall": "O(...)",
  "steps": [
    {{
      "step_number": 1,
      "line_number": 1,
      "code": "...",
      "explanation": "...",
      "mechanics": "...",
      "variables": {{"var_name": "val"}},
      "modified_vars": ["var_name"],
      "call_stack": ["<global>"],
      "edge_cases": "...",
      "time_complexity": "O(1)"
    }}
  ],
  "line_explanations": {{
    "1": "Detailed explanation of line 1",
    "2": "Detailed explanation of line 2"
  }}
}}
"""


@router.post("/analyze-steps", response_model=CodeAnalysisResponse)
async def analyze_code_steps(request: CodeAnalysisRequest):
    """
    Analyzes code line-by-line and generates an interactive execution trace
    with active variable states, call stacks, and deep educational explanations.
    """
    raw_code = request.code.strip()
    if not raw_code:
        raise HTTPException(status_code=400, detail="Code cannot be empty.")

    lines = raw_code.split("\n")
    language = request.language or "python"

    # Set API Keys for litellm
    if settings.GEMINI_API_KEY:
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
    if settings.GROQ_API_KEY:
        os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY

    # Target LLM models with fallback
    models_to_try = []
    if settings.GEMINI_API_KEY:
        models_to_try.extend(["gemini/gemini-3.8-flash", "gemini/gemini-3.5-flash", "gemini/gemini-2.5-flash"])
    if settings.GROQ_API_KEY:
        models_to_try.extend(["groq/openai/gpt-oss-20b", "groq/llama-3.3-70b-versatile", "groq/llama-3.1-8b-instant"])

    prompt = VISUALIZER_PROMPT_TEMPLATE.format(language=language, code=raw_code)

    parsed_result = None
    for model_name in models_to_try:
        try:
            logger.info(f"Analyzing code line-by-line with model: {model_name}")
            response = litellm.completion(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a professional computer science visualization and line-by-line code explanation engine. Always return strict valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            raw_content = response.choices[0].message.content.strip()
            if raw_content.startswith("```json"):
                raw_content = raw_content[7:]
            if raw_content.startswith("```"):
                raw_content = raw_content[3:]
            if raw_content.endswith("```"):
                raw_content = raw_content[:-3]

            parsed_result = json.loads(raw_content.strip())
            break
        except Exception as e:
            logger.warning(f"Model {model_name} failed for code visualization: {e}")
            continue

    if parsed_result:
        try:
            # Normalize steps and line explanations
            steps_data = []
            for idx, s in enumerate(parsed_result.get("steps", [])):
                line_no = s.get("line_number", idx + 1)
                code_text = s.get("code") or (lines[line_no - 1] if 0 <= line_no - 1 < len(lines) else "")
                steps_data.append(LineStep(
                    step_number=s.get("step_number", idx + 1),
                    line_number=line_no,
                    code=code_text,
                    explanation=s.get("explanation", f"Executing line {line_no}"),
                    mechanics=s.get("mechanics", "Evaluates statement"),
                    variables=s.get("variables", {}),
                    modified_vars=s.get("modified_vars", []),
                    call_stack=s.get("call_stack", ["<global>"]),
                    edge_cases=s.get("edge_cases"),
                    time_complexity=s.get("time_complexity", "O(1)")
                ))

            # Normalize line explanations
            line_exps = {}
            for k, v in parsed_result.get("line_explanations", {}).items():
                try:
                    line_exps[int(k)] = str(v)
                except ValueError:
                    pass

            return CodeAnalysisResponse(
                title=parsed_result.get("title", f"{language.title()} Code Analysis"),
                language=language,
                total_lines=len(lines),
                total_steps=len(steps_data),
                overview=parsed_result.get("overview", "Line-by-line breakdown of the program."),
                time_complexity_overall=parsed_result.get("time_complexity_overall", "O(N)"),
                space_complexity_overall=parsed_result.get("space_complexity_overall", "O(1)"),
                steps=steps_data,
                line_explanations=line_exps
            )
        except Exception as e:
            logger.error(f"Error structuring LLM response: {e}")

    # Fallback: Deterministic static line-by-line generator if all LLMs fail or are offline
    fallback_steps = []
    fallback_explanations = {}
    mock_vars = {}

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("//"):
            exp = "Comment or empty line; ignored at runtime."
            mech = "Skipped by runtime."
        elif "=" in stripped and not stripped.startswith("if") and not stripped.startswith("while"):
            parts = stripped.split("=", 1)
            var_name = parts[0].replace("let ", "").replace("const ", "").replace("var ", "").strip()
            val_expr = parts[1].strip().rstrip(";")
            mock_vars[var_name] = val_expr
            exp = f"Variable `{var_name}` is initialized/assigned with value `{val_expr}`."
            mech = f"Allocates memory address for `{var_name}` and binds value `{val_expr}`."
        elif stripped.startswith("def ") or stripped.startswith("function "):
            fn_name = stripped.split("(")[0].replace("def ", "").replace("function ", "").strip()
            exp = f"Defines function `{fn_name}` in the current scope."
            mech = f"Registers function object `{fn_name}` in the symbol table."
        elif stripped.startswith("for ") or stripped.startswith("while "):
            exp = "Loop header: checks termination condition and advances iteration."
            mech = "Evaluates loop conditional test; jumps to loop body if truthy."
        elif stripped.startswith("if ") or stripped.startswith("elif ") or stripped.startswith("else"):
            exp = "Conditional branch: evaluates condition to determine execution path."
            mech = "Branch instruction executed based on boolean truthiness."
        elif stripped.startswith("return "):
            val = stripped.replace("return ", "").rstrip(";")
            exp = f"Returns `{val}` from current function frame to caller."
            mech = "Pops current stack frame and places return value in caller register."
        elif stripped.startswith("print(") or stripped.startswith("console.log("):
            exp = "Outputs data to standard output console."
            mech = "Calls I/O write system routine."
        else:
            exp = f"Executes expression: `{stripped}`"
            mech = "Evaluates statement sequentially in current execution thread."

        fallback_explanations[i] = exp
        fallback_steps.append(LineStep(
            step_number=len(fallback_steps) + 1,
            line_number=i,
            code=line,
            explanation=exp,
            mechanics=mech,
            variables=dict(mock_vars),
            modified_vars=list(mock_vars.keys())[-1:] if mock_vars else [],
            call_stack=["<global>"],
            edge_cases="Check for null pointers or unexpected input types.",
            time_complexity="O(1)"
        ))

    return CodeAnalysisResponse(
        title=f"{language.title()} Program Execution Trace",
        language=language,
        total_lines=len(lines),
        total_steps=len(fallback_steps),
        overview=f"Sequential line-by-line visual breakdown of {len(lines)} lines of {language} code.",
        time_complexity_overall="O(N)",
        space_complexity_overall="O(1)",
        steps=fallback_steps,
        line_explanations=fallback_explanations
    )
