# Model and runtime files hosted with the site

Loaded only when a visitor uses "Ask the painting"; everything runs in the visitor's own browser.

- `minilm/model_quantized.onnx`, `minilm/vocab.txt`: the sentence-embedding model all-MiniLM-L6-v2 (384 dimensions,
  8-bit weights), from https://huggingface.co/Xenova/all-MiniLM-L6-v2 (an ONNX export of
  https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2). Apache License 2.0.
- `ort/`: ONNX Runtime Web 1.31.1 (its WebAssembly build), copied from the `onnxruntime-web` npm package. MIT License.
