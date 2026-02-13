import codecs

def convert_to_sjis(input_file, output_file):
    try:
        with codecs.open(input_file, 'r', 'utf-8') as f:
            content = f.read()
            
        with codecs.open(output_file, 'w', 'cp932') as f:
            f.write(content)
        print(f"Successfully converted {input_file} to {output_file} (Shift-JIS)")
    except Exception as e:
        print(f"Error converting file: {e}")

if __name__ == '__main__':
    convert_to_sjis('ModuleLEDD.bas', 'ModuleLEDD_SJIS.bas')
