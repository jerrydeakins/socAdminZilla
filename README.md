# SocAdmin Firefox 0.3.37

VK-only browser toolbar extension.

## 0.3.37
- Fixed publication card button layout: Auto is centered; copy/edit stay left and delete is on the far right on one row.
- Unified remote-image retrieval through the extension background context.
- Auto now transfers retrieved images to VK as File objects.
- Copy image now writes the actual image Blob to the system clipboard.
- Content scripts remain restricted to vk.com/vk.ru; broad host permission is used only for retrieving VK CDN image resources.


## 0.3.38
- После «Авто» карточка затемняется и показывает две кнопки подтверждения по центру: зелёная check и красная circle-xmark.
- Check удаляет пост из очереди «Публикация».
- Отмена возвращает карточку в исходное состояние без изменений очереди.

## 0.3.41
- Исправлено отображение подтверждения после «Авто»: кнопки check и circle-xmark скрыты до момента успешного запуска «Авто».
- Для скрытия используется явное правило `[hidden]`, чтобы CSS `display:flex` не отменял нативное скрытие элемента.


## 0.3.41
- Исправлен возврат/старт сбора при каноническом редиректе VK: pending-сбор больше не требует точного совпадения полного URL источника.
- Для продолжения сбора дополнительно проверяется, что текущая и исходная страницы относятся к vk.ru/vk.com.


### 0.3.41
- Исправлен сбор постов из источника: количество DOM-контейнеров больше не считается количеством успешно извлечённых постов.
- Коллектор продолжает сбор, пока не получит заданное количество реально извлечённых постов или не достигнет своих ограничений по прокрутке/времени.


## 0.3.42
- Collection startup now waits for a real extractable VK post using MutationObserver, with a 15-second timeout, instead of relying on a fixed delay after navigation.


## 0.3.44
- Вкладка «Модерация»: «Зона модерации» расширена примерно на 25% относительно прежней ширины левой колонки (40% → 50% сетки).
- Переработка визуального стиля карточек постов отложена на следующий шаг.
- Логотип сообщества пока не добавляется в интерфейс.


## 0.3.44
- Источники: левая колонка 360 px, правая занимает оставшуюся ширину.
- Карточки источников переведены на flex-компоновку: слева блок логотипа, справа название и URL сообщества.
- Зона модерации: 460 px.
- Редактор поста: 500 px.
- Логотипы источников поддержаны в карточке через поле `logo`; автоматическое получение логотипа пока не добавлено.


## Version 0.3.46
- Posts panel width reduced to 500px content column next to 360px Sources.
- Source logo block uses only `padding-right: 16px`.
- Community logos are fetched once when adding a source or home community and cached locally in `browser.storage.local` under `settings.communityLogos`, keyed by normalized VK community URL.
- Existing source `logo` values are migrated into the shared local logo cache.


## 0.3.46
- Улучшено получение логотипов сообществ: DOMParser + несколько OpenGraph/meta/link вариантов и regex fallback.
- Логотип по-прежнему загружается один раз при добавлении источника/домашнего сообщества и хранится локально в settings.communityLogos.


## 0.3.48
- Получение логотипа сообщества сначала ищет контейнер VK `#community_avatar_<id>` и извлекает изображение из его `img`, `srcset` или CSS `background-image`.
- OpenGraph/meta остаётся fallback для вариантов разметки VK без доступного изображения внутри контейнера.
- Логотип по-прежнему загружается один раз при добавлении источника/домашнего сообщества и хранится локально в `settings.communityLogos`.


### 0.3.48
- При импорте настроек загружаются отсутствующие логотипы источников и домашних сообществ; уже закэшированные логотипы повторно не запрашиваются.


### 0.3.49
- Получение аватара использует реальный DOM авторизованной страницы VK: `#community_avatar_<id> img`, включая `src`/`srcset`.
- Для добавления/импорта сообществ используется фоновая неактивная вкладка VK; после получения URL вкладка закрывается.
- Локальный бинарный кэш `settings.communityLogos` не включается в экспорт настроек; при импорте отсутствующие логотипы загружаются заново.
