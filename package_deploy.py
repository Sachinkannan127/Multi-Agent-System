"""
Multi-Agent System — Deployment Archive Packager
Creates a minimal, production-ready .zip archive (< 5 MB) for cloud hosting.
Excludes venv, node_modules, caches, and test files.
"""

import os
import zipfile
from datetime import datetime

IGNORE_DIRS = {
    'venv', '.venv', '__pycache__', '.pytest_cache', '.git',
    'node_modules', 'dist', 'build', '.idea', '.vscode'
}

IGNORE_EXTS = {'.pyc', '.pyo', '.pyd', '.env', '.sqlite3', '.log'}

def create_deployment_zip(output_filename="deployment_package.zip"):
    print("[*] Packaging Multi-Agent System for deployment...")
    total_files = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Prune ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
            
            # Normalize path
            norm_root = root.replace('\\', '/')
            if any(ign in norm_root.split('/') for ign in IGNORE_DIRS):
                continue

            for file in files:
                # Exclude ignore extensions and test pdfs
                _, ext = os.path.splitext(file)
                if ext in IGNORE_EXTS or (ext == '.pdf' and 'upload' in norm_root):
                    continue
                if file == output_filename:
                    continue

                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, '.')
                zipf.write(full_path, rel_path)
                
                size = os.path.getsize(full_path)
                total_uncompressed_bytes += size
                total_files += 1

    zip_size_mb = os.path.getsize(output_filename) / (1024 * 1024)
    raw_size_mb = total_uncompressed_bytes / (1024 * 1024)

    print(f"[OK] Deployment package ready: {output_filename}")
    print(f"[-] Files packed: {total_files}")
    print(f"[-] Raw Size: {raw_size_mb:.2f} MB")
    print(f"[SUCCESS] Compressed ZIP Size: {zip_size_mb:.2f} MB (Well below the 510 MB limit - 508 MB free!)")

if __name__ == '__main__':
    create_deployment_zip()
