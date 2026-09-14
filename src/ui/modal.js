export async function showModal({
    title = 'Подтверждение',
    message = 'Вы уверены?',
    confirmText = 'Удалить',
    cancelText = 'Отмена'
}) {
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'soc-admin-modal';

        const content = document.createElement('div');
        content.className = 'soc-admin-modal-content';

        const titleElement = document.createElement('h3');
        titleElement.className = 'soc-admin-modal-title';
        titleElement.textContent = title;

        const body = document.createElement('div');
        body.className = 'soc-admin-modal-body';
        body.textContent = message;

        const actions = document.createElement('div');
        actions.className = 'soc-admin-modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'soc-admin-btn soc-admin-btn-cancel';
        cancelBtn.type = 'button';
        cancelBtn.textContent = cancelText;

        const confirmBtn = document.createElement('button');
        confirmBtn.className =
            'soc-admin-btn soc-admin-btn-confirm soc-admin-btn-danger';
        confirmBtn.type = 'button';
        confirmBtn.textContent = confirmText;

        actions.append(cancelBtn, confirmBtn);
        content.append(titleElement, body, actions);
        dialog.append(content);

        document.body.appendChild(dialog);
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
