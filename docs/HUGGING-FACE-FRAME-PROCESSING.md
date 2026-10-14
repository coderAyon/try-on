# Hosted sunglasses frame processing

Opaque custom sunglasses photos are sent to Bria's public [`BRIA-RMBG-2.0` Hugging Face Space](https://huggingface.co/spaces/briaai/BRIA-RMBG-2.0), which runs on Hugging Face ZeroGPU. The Space returns a transparent PNG cutout; the portrait remains in the browser and is never sent to the model. PNGs that already have transparent pixels skip hosted processing. The image is sent only when the user chooses to fit a custom frame.

## Configure the free endpoint

1. Copy `.env.example` to `.env`.
2. Optionally set `HF_SPACE_TOKEN` to a Hugging Face token with read access to public Spaces. If unset, an existing `HF_TOKEN` is used; with neither token, the app uses the shared anonymous quota. Authenticated free accounts currently get up to 5 GPU minutes per day, while anonymous calls share a smaller pool.
3. Restart the API server. Keep tokens server-side; never add a `VITE_` prefix or commit `.env`.

ZeroGPU is shared capacity, so a request may queue or fail when the daily quota is exhausted or the Space is busy. This route does not use Hugging Face Inference Provider credits. Free availability and limits are controlled by Hugging Face and can change.

The RMBG 2.0 model is licensed for non-commercial use. Review the [model card](https://huggingface.co/briaai/RMBG-2.0) before publishing or using the project commercially.

This pipeline isolates the sunglasses and preserves their source pixels. It does not repaint the wearer's portrait or itself determine face-fit geometry; the existing browser face landmarks and compositing code handle positioning and scale.
