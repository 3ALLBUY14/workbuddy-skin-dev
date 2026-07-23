#!/usr/bin/env python3
"""
Skill Packager - Creates a distributable zip file of a skill folder (vendored for CI).
Source: WorkBuddy builtin skill-creator/scripts/package_skill.py

Usage:
    python .github/scripts/package_skill.py <path/to/skill-folder> [output-directory]
"""

import sys
import zipfile
from pathlib import Path
from quick_validate import validate_skill

# 打包时跳过的目录 (CI 产物 / VCS / 缓存), 不进技能 zip
SKIP_DIRS = {'.git', 'dist', '__pycache__', '.github'}


def package_skill(skill_path, output_dir=None):
    skill_path = Path(skill_path).resolve()

    if not skill_path.exists():
        print(f"❌ Error: Skill folder not found: {skill_path}")
        return None
    if not skill_path.is_dir():
        print(f"❌ Error: Path is not a directory: {skill_path}")
        return None

    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        print(f"❌ Error: SKILL.md not found in {skill_path}")
        return None

    print("🔍 Validating skill...")
    valid, message = validate_skill(skill_path)
    if not valid:
        print(f"❌ Validation failed: {message}")
        print("   Please fix the validation errors before packaging.")
        return None
    print(f"✅ {message}\n")

    skill_name = skill_path.name
    if output_dir:
        output_path = Path(output_dir).resolve()
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path = Path.cwd()

    zip_filename = output_path / f"{skill_name}.zip"

    try:
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in skill_path.rglob('*'):
                if not file_path.is_file():
                    continue
                # 跳过 CI / 仓库 / 缓存目录
                if any(part in SKIP_DIRS for part in file_path.relative_to(skill_path).parts):
                    continue
                arcname = file_path.relative_to(skill_path.parent)
                zipf.write(file_path, arcname)
                print(f"  Added: {arcname}")

        print(f"\n✅ Successfully packaged skill to: {zip_filename}")
        return zip_filename

    except Exception as e:
        print(f"❌ Error creating zip file: {e}")
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python .github/scripts/package_skill.py <path/to/skill-folder> [output-directory]")
        sys.exit(1)

    skill_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"📦 Packaging skill: {skill_path}")
    if output_dir:
        print(f"   Output directory: {output_dir}")
    print()

    result = package_skill(skill_path, output_dir)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
