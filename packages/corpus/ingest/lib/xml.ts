/** Small helpers over @xmldom/xmldom for walking TEI documents. */
import { DOMParser, type Element, type Node } from '@xmldom/xmldom';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export function parseXml(xml: string): Element {
  const doc = new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') {
        throw new Error(`XML ${level}: ${message}`);
      }
    },
  }).parseFromString(xml, 'text/xml');
  if (!doc.documentElement) {
    throw new Error('XML has no document element');
  }
  return doc.documentElement;
}

export function isElement(node: Node): node is Element {
  return node.nodeType === ELEMENT_NODE;
}

export function isText(node: Node): boolean {
  return node.nodeType === TEXT_NODE;
}

export function childNodes(node: Node): Node[] {
  return Array.from({ length: node.childNodes.length }, (_, i) => node.childNodes[i]).filter(
    (child): child is Node => child != null,
  );
}

export function children(node: Node, name?: string): Element[] {
  return childNodes(node).filter(
    (child): child is Element =>
      isElement(child) && (name === undefined || child.localName === name),
  );
}

export function descendants(node: Node, name: string): Element[] {
  const found: Element[] = [];
  const visit = (current: Node) => {
    for (const child of children(current)) {
      if (child.localName === name) {
        found.push(child);
      }
      visit(child);
    }
  };
  visit(node);
  return found;
}

export function first(node: Node, name: string): Element | undefined {
  return descendants(node, name)[0];
}

export function attr(element: Element, name: string): string | undefined {
  return element.getAttribute(name) ?? undefined;
}

/** The element's text with whitespace collapsed. */
export function plainText(node: Node): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
}
