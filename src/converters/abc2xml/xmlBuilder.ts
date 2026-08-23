export class XmlNode {
  name: string;
  attributes: Record<string, string | number | boolean>;
  children: Array<XmlNode | string>;

  constructor(name: string, attributes: Record<string, string | number | boolean> = {}) {
    this.name = name;
    this.attributes = { ...attributes };
    this.children = [];
  }

  attr(key: string, value: string | number | boolean | undefined): this {
    if (value !== undefined) {
      this.attributes[key] = value;
    }
    return this;
  }

  ele(name: string, attributes: Record<string, string | number | boolean> = {}, text?: string | number): XmlNode {
    const child = new XmlNode(name, attributes);
    if (text !== undefined) {
      child.text(String(text));
    }
    this.children.push(child);
    return child;
  }

  add(node: XmlNode): this {
    this.children.push(node);
    return this;
  }

  text(str: string): this {
    this.children.push(str);
    return this;
  }

  toString(indentSpaces: number = 2, currentDepth: number = 0): string {
    const pad = ' '.repeat(indentSpaces * currentDepth);
    const attrEntries = Object.entries(this.attributes).filter(([, v]) => v !== undefined && v !== false);
    const attrStr = attrEntries.length > 0
      ? ' ' + attrEntries.map(([k, v]) => `${k}="${escapeXml(String(v))}"`).join(' ')
      : '';

    if (this.children.length === 0) {
      return `${pad}<${this.name}${attrStr}/>`;
    }

    // If only one text child, render inline: <tag>text</tag>
    if (this.children.length === 1 && typeof this.children[0] === 'string') {
      return `${pad}<${this.name}${attrStr}>${escapeXml(this.children[0])}</${this.name}>`;
    }

    const childStrings = this.children.map((c) => {
      if (typeof c === 'string') {
        return ' '.repeat(indentSpaces * (currentDepth + 1)) + escapeXml(c);
      }
      return c.toString(indentSpaces, currentDepth + 1);
    });

    return `${pad}<${this.name}${attrStr}>\n${childStrings.join('\n')}\n${pad}</${this.name}>`;
  }
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class XmlDocument {
  root: XmlNode;
  version: string;
  encoding: string;
  doctype?: string;

  constructor(rootName: string, attributes: Record<string, string | number | boolean> = {}) {
    this.root = new XmlNode(rootName, attributes);
    this.version = '1.0';
    this.encoding = 'UTF-8';
  }

  toString(indentSpaces: number = 2): string {
    const lines: string[] = [];
    lines.push(`<?xml version="${this.version}" encoding="${this.encoding}" standalone="no"?>`);
    if (this.doctype) {
      lines.push(this.doctype);
    }
    lines.push(this.root.toString(indentSpaces, 0));
    return lines.join('\n') + '\n';
  }
}
