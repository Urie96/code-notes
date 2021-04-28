import Vue from "vue";
import "./style/zsh.styl";

function genZshWindow() {
    setTimeout(() => {
        document.querySelectorAll('div.language-zsh').forEach(el => {
            if (el.hasAttribute('zsh')) return
            el.setAttribute('zsh', '')
            const div = document.createElement('div')
            div.className = 'zsh-window'
            div.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="14" viewBox="0 0 54 14"><g fill="none" fill-rule="evenodd" transform="translate(1 1)"><circle cx="6" cy="6" r="6" fill="#FF5F56" stroke="#E0443E" stroke-width=".5"></circle><circle cx="26" cy="6" r="6" fill="#FFBD2E" stroke="#DEA123" stroke-width=".5"></circle><circle cx="46" cy="6" r="6" fill="#27C93F" stroke="#1AAB29" stroke-width=".5"></circle></g></svg>`
            el.insertBefore(div, el.firstChild)
        })
    }, 1000);
}

export default Vue.extend({
    mounted() {
        genZshWindow();
    },
    updated() {
        genZshWindow();
    },
});