// https://gist.github.com/karlgroves/7544592
function getDomPath(element: HTMLElement): string[] {
    const stack: string[] = [];
    while (element.parentElement !== null) {
        let sibCount = 0;
        let sibIndex = 0;
        for (const sibling of element.parentElement.childNodes) {
            if (sibling.nodeName == element.nodeName) {
                if (sibling === element) {
                    sibIndex = sibCount;
                }
                sibCount++;
            }
        }
        if (element.hasAttribute('id') && element.id !== '') {
            stack.unshift(element.nodeName.toLowerCase() + '#' + element.id);
        } else if (sibCount > 1) {
            stack.unshift(element.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
        } else {
            stack.unshift(element.nodeName.toLowerCase());
        }
        element = element.parentElement;
    }
    return stack;
}
