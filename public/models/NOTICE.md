# Model and runtime files hosted with the site

Loaded only when a visitor uses "Ask the painting"; everything runs in the visitor's own browser.

- `minilm/model_quantized.onnx`, `minilm/vocab.txt`: the sentence-embedding model all-MiniLM-L6-v2 (384 dimensions,
  8-bit weights), from https://huggingface.co/Xenova/all-MiniLM-L6-v2 (an ONNX export of
  https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2). Apache License 2.0.
- `ort/`: ONNX Runtime Web 1.31.1 (its WebAssembly build), copied from the `onnxruntime-web` npm package. MIT License.

Changed here: in `vocab.txt` every entry that holds a CJK character (about a fifth of the model's vocabulary, never
reached by English text) is replaced by a placeholder of its own, so the site hosts no Chinese text but the seal
(AGENTS.md, hard rules). The entries keep their line numbers, which are the model's token ids, so English tokenizes
exactly as before.
