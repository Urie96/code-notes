import Message from "./message";
import Vue from "vue";
import "./style/code.styl";

const options = CODE_COPY_OPTIONS;

const isMobile = () => navigator
    ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/iu.test(navigator.userAgent)
    : false;

const insertCopyButton = (codeBlockElement) => {
    if (codeBlockElement.hasAttribute("copy-code-registerd")) return
    const copyElement = document.createElement("button");
    copyElement.className = "copy-code-button";
    copyElement.innerHTML =
        '<svg height="512" viewBox="0 0 24 24" width="512" xmlns="http://www.w3.org/2000/svg"><path d="M4 6.75A4.756 4.756 0 018.75 2h9.133a2.745 2.745 0 00-2.633-2H3.75A2.752 2.752 0 001 2.75v15.5A2.752 2.752 0 003.75 21H4z"/><path d="M20.25 4H8.75A2.752 2.752 0 006 6.75v14.5A2.752 2.752 0 008.75 24h11.5A2.752 2.752 0 0023 21.25V6.75A2.752 2.752 0 0020.25 4zm-2 17h-7.5a.75.75 0 010-1.5h7.5a.75.75 0 010 1.5zm0-4h-7.5a.75.75 0 010-1.5h7.5a.75.75 0 010 1.5zm0-3.5h-7.5a.75.75 0 010-1.5h7.5a.75.75 0 010 1.5zm0-4h-7.5a.75.75 0 010-1.5h7.5a.75.75 0 010 1.5z"/></svg>';
    copyElement.addEventListener("click", () => {
        copyToClipboard(codeBlockElement.innerText);
    });
    // copyElement.setAttribute("aria-label", "Copy");
    // copyElement.setAttribute("data-balloon-pos", "left");
    if (codeBlockElement.parentElement)
        codeBlockElement.parentElement.insertBefore(copyElement, codeBlockElement);
    codeBlockElement.setAttribute("copy-code-registerd", "");
}

const genCopyButton = () => {
    if (isMobile() && !options.showInMobile) return
    const selector = options.selector;
    setTimeout(() => {
        const insert = (els) => document
            .querySelectorAll(els)
            .forEach(insertCopyButton);
        if (typeof selector === "string") {
            insert(selector)
        } else if (Array.isArray(selector)) {
            selector.forEach(insert)
        }
    }, 1000);
}

const lazyLoad = (func) => {
    let res = null
    return () => res ? res : res = func()
}
const messageSingleton = lazyLoad(() => new Message())
const textAreaSingleton = lazyLoad(() => {
    const textAreaElement = document.createElement("textarea");
    textAreaElement.setAttribute("readonly", "");
    textAreaElement.style.position = "absolute";
    textAreaElement.style.top = "-9999px";
    return textAreaElement
})

const copyToClipboard = (code) => {
    const message = messageSingleton()
    const textAreaElement = textAreaSingleton()
    textAreaElement.value = code;
    document.body.appendChild(textAreaElement);
    textAreaElement.select();
    document.execCommand("copy");
    document.body.removeChild(textAreaElement);
    message.pop("Copied", options.duration);
}

export default Vue.extend({
    mounted() {
        genCopyButton();
    },
    updated() {
        genCopyButton();
    },
});