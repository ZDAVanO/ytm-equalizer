import eq_icon from '@/assets/equalizer-svgrepo-com.svg';
import * as Constants from '@constants';
import { waitForElem } from '@utils';
import { setupAlbumArtObserver, updateButtonGlow } from './albumArt';

// MARK: insertEQButton
export function insertEQButton(onClick: () => void): HTMLButtonElement | null {
    let eqBtn: HTMLButtonElement | null = null;

    waitForElem(Constants.NAV_BAR_SELECTOR, (panel) => {
        const btn = document.createElement("button");
        btn.className = Constants.EQ_BTN;
        btn.innerHTML = `<img src="${eq_icon}" alt="EQ Icon" draggable="false">`;
        btn.title = "Open Equalizer";

        btn.onclick = onClick;

        eqBtn = btn;
        panel.insertBefore(btn, panel.firstChild);

        setupAlbumArtObserver((imageUrl) => updateButtonGlow(imageUrl, eqBtn));
    });
    return eqBtn;
}

// MARK: updateEQBtnVisual
export function updateEQBtnVisual(eqBtn: HTMLButtonElement | null, eqEnabled: boolean) {
    if (eqBtn) {
        eqBtn.classList.toggle('on', eqEnabled);
    }
}


