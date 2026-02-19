import subprocess
import json

# Check EXIF data for one of the problematic images
image_path = "D:/Photos Ai/mobile/IMG_0513.HEIC"

try:
    result = subprocess.run(
        ['exiftool', '-j', '-Orientation', '-Rotation', '-ImageWidth', '-ImageHeight', image_path],
        capture_output=True,
        text=True,
        check=True
    )

    data = json.loads(result.stdout)[0]

    print("EXIF Orientation Data:")
    print("=" * 50)
    for key, value in data.items():
        if key != 'SourceFile':
            print(f"{key}: {value}")

except subprocess.CalledProcessError as e:
    print(f"Error running exiftool: {e}")
except Exception as e:
    print(f"Error: {e}")
