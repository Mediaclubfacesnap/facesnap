import sys
import traceback

def test_startup():
    try:
        from app.main import app
        print("FastAPI app successfully imported!")
        print("Routes registered:")
        for route in app.routes:
            print(f"- {route.path}")
        return True
    except Exception as e:
        print("ERROR DURING STARTUP:")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_startup()
    sys.exit(0 if success else 1)
