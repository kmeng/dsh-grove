![The Grove panel between DeepSeek Harness and an Obsidian vault](preview.svg)

Open Grove from the left sidebar, connect your own Obsidian vault, and keep what you explore as Markdown notes you can revisit and revise.

On Home, capture ideas or ask to find an idea, report, or knowledge note. Start research from an idea and keep follow-up questions and their reports in one conversation. Confirm a report, then save its findings to Knowledge with one click and expand the entry to read the full saved report version. Continue research from the original project. While Grove is running, it generates tags and related entries locally once a day so you can filter and browse your library.

Start in Works or use a knowledge entry or report as a source. Discuss and confirm the topic, outline, and section candidates in the left pane. The right pane shows the article preview. Add material to the current section and keep confirmed text and references traceable. Upload images, render charts from data, call a configured image model, or use its prompt suggestions. Save the article and add that version to Knowledge, or reopen drafts from the works list.

The writing model can follow the host default or use another host model. A custom HTTPS writing endpoint uses `GROVE_WORK_MODEL_KEY`. Image generation is optional. Enter the full HTTPS image generation endpoint and model name. The endpoint must return `data[0].b64_json` and the host uses `GROVE_IMAGE_MODEL_KEY`.
