//
// Description: The hljsLog export logs a piece of code to the web console, formatting with highlight.js. highlight.js
// must be installed globally, or you can add an import. Formatting can be buggy as the parser doesn't try to generate
// console equivalents for the nested <span>s emitted by highlight.js.
//

const t: Record<string, string> = {};

// Monokai
t.subst = t.tag = 'color: #f8f8f2';
t.emphasis = t.strong = 'color: #a8a8a2';
t.bullet = t.link = t.literal = t.number = t.quote = t.regexp = 'color: #ae81ff';
t.code = t.section = t['selector-class'] = t.title = 'color: #a6e22e';
t.strong += ';font-weight: 700';
t.emphasis += ';font-style: italic';
t.attr = t.keyword = t.name = t['selector-tag'] = 'color: #f92672';
t.attribute = t.symbol = 'color: #66d9ef';
t.params = 'color: #f8f8f2';
t.addition = t.built_in = t['builtin-name'] = t['selector-attr'] = t['selector-id'] = t['selector-pseudo'] = t.string = t['template-variable'] = t.type = t.variable = 'color: #e6db74';
t.comment = t.deletion = t.meta = 'color: #75715e';

// https://github.com/jonschlinkert/unescape
//
// The MIT License (MIT)
//
// Copyright (c) 2014, 2016-2017, Jon Schlinkert
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
function decode(text: string): string {
    return text
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, '\'')
        .replace(/&amp;/g, '&')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&cent;/g, '¢')
        .replace(/&copy;/g, '©')
        .replace(/&euro;/g, '€')
        .replace(/&pound;/g, '£')
        .replace(/&reg;/g, '®')
        .replace(/&yen;/g, '¥')
        .replace(/&#(\d+);/g, (_$$, $0) => String.fromCodePoint(+$0))
        .replace(/&#x([\dA-Fa-f]+);/g, (_$$, $0) => String.fromCodePoint(parseInt($0, 16)));
}

// http://jsfiddle.net/yg6hk/5/
/**
 * Logs a piece of code to the web console, formatting with highlight.js.
 *
 * Formatting can be buggy as the parser doesn't try to generate console equivalents for the nested &lt;span>s emitted
 * by highlight.js.
 *
 * @param location An extra detail string, typically representing the path to the source code.
 * @param source The source code to be formatted and then logged.
 * @param lang The language name to pass to highlight.js.
 * @param tokenTypeStyleMap Optional: a dictionary mapping hljs class names to CSS styles.
 */
export default function hljsLog(location: string, source: string, lang: string, tokenTypeStyleMap: Record<string, string> = t): void {
    const {value: code} = hljs.highlight(lang, source, true);

    const startTagRe = /<span class="hljs-(\w+)">/gi;
    const endTagRe = /<\/span>/gi;

    const logArguments = [
        `%c${location}%c\n${decode(code).replace(startTagRe, '%c').replace(endTagRe, '%c')}`,
        'color: #58D68D',
        '',
    ];

    let reResultArray;
    while ((reResultArray = startTagRe.exec(code))) { // this assumes all spans have relevant closing tags
        logArguments.push(tokenTypeStyleMap[reResultArray[1]]);
        logArguments.push('');
    }

    console.log(...logArguments);
}
