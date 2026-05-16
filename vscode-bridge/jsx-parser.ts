export interface JsxProp {
  name: string;
  value: string | boolean;
  isExpression: boolean;
}

export function extractJsxProps(text: string, startOffset: number): JsxProp[] {
  // Find the end of the opening tag
  const tagContent = findOpeningTagContent(text, startOffset);
  if (!tagContent) return [];

  // Strip tag name (first word)
  const propsContent = tagContent.replace(/^[a-zA-Z0-9.-]+/, '').trim();
  if (!propsContent) return [];

  const props: JsxProp[] = [];
  // Regex for props:
  // 1. name={expression}
  // 2. name="string"
  // 3. name='string'
  // 4. boolean name
  const propPattern = /([\w-]+)(?:\s*=\s*(?:\{([\s\S]*?)\}|"([^"]*)"|'([^']*)'))?/g;
  
  let match;
  while ((match = propPattern.exec(propsContent)) !== null) {
    const name = match[1];
    if (name === 'className' || name === 'style' || name === 'key' || name === 'ref') continue;

    const expression = match[2];
    const doubleQuote = match[3];
    const singleQuote = match[4];

    if (expression !== undefined) {
      props.push({ name, value: expression.trim(), isExpression: true });
    } else if (doubleQuote !== undefined) {
      props.push({ name, value: doubleQuote, isExpression: false });
    } else if (singleQuote !== undefined) {
      props.push({ name, value: singleQuote, isExpression: false });
    } else {
      // Boolean prop (e.g. <Button primary />)
      props.push({ name, value: true, isExpression: false });
    }
  }

  return props;
}

function findOpeningTagContent(text: string, startOffset: number): string | null {
  const rest = text.slice(startOffset);
  // Look for the first '<' after startOffset if it's not already pointing to it
  const start = rest.indexOf('<');
  if (start === -1) return null;

  let depth = 0;
  let inString: string | null = null;
  let i = start;
  
  // Find the matching '>' but handle strings and nested braces (expressions)
  while (i < rest.length) {
    const char = rest[i];
    
    if (inString) {
      if (char === inString && rest[i-1] !== '\\') inString = null;
    } else if (char === '"' || char === "'") {
      inString = char;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
    } else if (char === '>' && depth === 0) {
      // End of opening tag
      return rest.slice(start + 1, i).replace(/\/$/, '').trim();
    }
    i++;
  }

  return null;
}
