export async function showModal({
    title = 'Подтверждение',
    message = 'Вы уверены?',
    confirmText = 'Удалить',
    cancelText = 'Отмена'
}) {
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'soc-admin-modal';

        dialog.innerHTML = `
            <div class="soc-admin-modal-content">
                <h3 class="soc-admin-modal-title"></h3>
                <div class="soc-admin-modal-body"></div>
                <div class="soc-admin-modal-actions">
                    <button class="soc-admin-btn soc-admin-btn-cancel" type="button">${cancelText}</button>
                    <button class="soc-admin-btn soc-admin-btn-confirm soc-admin-btn-danger" type="button">${confirmText}</button>
                </div>
            </div>
        `;

        dialog.querySelector('.soc-admin-modal-title').textContent = title;
        dialog.querySelector('.soc-admin-modal-body').textContent = message;
        document.body.appendChild(dialog);

        const confirmBtn = dialog.querySelector('.soc-admin-btn-confirm');
        const cancelBtn = dialog.querySelector('.soc-admin-btn-cancel');
        if (!cancelText) cancelBtn.hidden = true;

        let isClosing = false;
        let fallbackTimer = null;

        const closeDialog = (result) => {
            if (isClosing) return;
            isClosing = true;

            confirmBtn.disabled = true;
            cancelBtn.disabled = true;
            dialog.classList.add('closing');

            const finish = () => {
                if (fallbackTimer) clearTimeout(fallbackTimer);
                dialog.close();
                dialog.remove();
                resolve(result);
            };

            dialog.addEventListener('animationend', finish, { once: true });
            fallbackTimer = setTimeout(finish, 250);
        };

        confirmBtn.addEventListener('click', () => closeDialog(true));
        cancelBtn.addEventListener('click', () => closeDialog(false));

        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            closeDialog(false);
        });

        dialog.addEventListener('click', (event) => {
            const rect = dialog.getBoundingClientRect();
            const isInDialog = (
                rect.top <= event.clientY && event.clientY <= rect.bottom &&
                rect.left <= event.clientX && event.clientX <= rect.right
            );

            if (!isInDialog) closeDialog(false);
        });

        dialog.showModal();
    });
}
