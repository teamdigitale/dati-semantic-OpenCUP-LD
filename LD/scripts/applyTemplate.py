import json
from pybars import Compiler
import urllib.parse

def encodeURIComponent(this,value):
    return urllib.parse.quote(str(value))

def apply_handlebars_template(template, data):
    compiler = Compiler()
    context = {
        'encodeURIComponent': encodeURIComponent
    }
    return compiler.compile(template)(data, helpers=context)

def main():
    import sys

    if len(sys.argv) < 3:
        print("Usage: python script.py input_file.json template_file.hbs")
        return

    input_file = sys.argv[1]
    template_file = sys.argv[2]

    with open(template_file, 'r') as file:
        template = file.read()

    with open(input_file, 'r') as file:
        json_obj=json.load(file)
        result = apply_handlebars_template(template, json_obj)
        print(result)

if __name__ == "__main__":
    main()
