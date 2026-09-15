import sys
import json
import traceback

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "error": "No script file provided"}))
        sys.exit(1)

    script_path = sys.argv[1]
    
    try:
        with open(script_path, "r", encoding="utf-8") as f:
            code = f.read()

        scope = {"__name__": "__main__"}
        exec(compile(code, script_path, "exec"), scope)
    except Exception as e:
        sys.stderr.write(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()
