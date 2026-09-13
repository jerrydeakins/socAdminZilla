import './modal.css';

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
                <h3 class="soc-admin-modal-title">${title}</h3>
                <div class="soc-admin-modal-body">${message}</div>
                <div class="soc-admin-modal-actions">
                    <button class="soc-admin-btn soc-admin-btn-cancel">${cancelText}</button>
                    <button class="soc-admin-btn soc-admin-btn-confirm soc-admin-btn-danger">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const confirmBtn = dialog.querySelector('.soc-admin-btn-confirm');
        const cancelBtn = dialog.querySelector('.soc-admin-btn-cancel');
        let isClosing = false;

        // Функция закрытия с защитой от двойного клика
        const closeDialog = (result) => {
            if (isClosing) return;
            isClosing = true;

            // Блокируем кнопки, чтобы предотвратить повторные нажатия
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;

            dialog.classList.add('closing');
            dialog.addEventListener('animationend', () => {
                dialog.close();
                dialog.remove();
                resolve(result);
            }, { once: true });
        };

        confirmBtn.addEventListener('click', () => closeDialog(true));
        cancelBtn.addEventListener('click', () => closeDialog(false));

        // Закрытие при клике мимо окна
        dialog.addEventListener('click', (e) => {
            const rect = dialog.getBoundingClientRect();
            const isInDialog = (
                rect.top <= e.clientY && e.clientY <= rect.bottom &&
                rect.left <= e.clientX && e.clientX <= rect.right
            );
            
            if (!isInDialog) closeDialog(false);
        });

        dialog.showModal();
    });
}