"""Pipeline A: Indirect Style Transfer (3D → 2D renders → Google Imagen → 3D reconstruct)."""

from pathlib import Path

from app.pipelines.base import BasePipeline, PipelineStage, ProgressCallback


class IndirectStyleTransferPipeline(BasePipeline):
    id = "pipeline_a_indirect"
    name = "3D → 2D → Google Imagen → 3D"
    description = (
        "Renders multi-view images of the 3D model, applies style transfer "
        "using Google Imagen 3 with a text prompt, then reconstructs "
        "the styled views back into a 3D model."
    )

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "title": "Style Prompt",
                    "description": "Text prompt describing the desired style (e.g., 'Ottoman blue ceramic tile with gold accents')",
                    "default": "Islamic geometric pattern with blue and gold ceramic tiles",
                },
                "num_views": {
                    "type": "integer",
                    "title": "Number of Views",
                    "description": "Number of camera angles to render",
                    "default": 8,
                    "minimum": 4,
                    "maximum": 16,
                },
                "render_resolution": {
                    "type": "integer",
                    "title": "Render Resolution",
                    "description": "Width/height of rendered images in pixels",
                    "default": 512,
                    "enum": [256, 512, 768, 1024],
                },
                "stylization_strength": {
                    "type": "number",
                    "title": "Stylization Strength",
                    "description": "How much to change the image (0.0 = no change, 1.0 = full generation)",
                    "default": 0.55,
                    "minimum": 0.1,
                    "maximum": 0.9,
                },
                "reconstruction_method": {
                    "type": "string",
                    "title": "3D Reconstruction Method",
                    "description": "Method to reconstruct 3D from styled images",
                    "default": "triposr",
                    "enum": ["triposr", "instantmesh", "wonder3d"],
                },
                "negative_prompt": {
                    "type": "string",
                    "title": "Negative Prompt",
                    "description": "What to avoid in the generated images",
                    "default": "blurry, low quality, distorted",
                },
            },
            "required": ["prompt"],
        }

    def get_stages(self) -> list[PipelineStage]:
        return [
            PipelineStage(
                name="render_views",
                description="Rendering multi-view images from 3D model",
                progress_weight=0.15,
            ),
            PipelineStage(
                name="stylize_images",
                description="Applying style transfer via Google Imagen",
                progress_weight=0.50,
            ),
            PipelineStage(
                name="reconstruct_3d",
                description="Reconstructing 3D model from styled images",
                progress_weight=0.30,
            ),
            PipelineStage(
                name="postprocess",
                description="Post-processing and alignment",
                progress_weight=0.05,
            ),
        ]

    async def execute(
        self,
        job_id: str,
        input_model_path: Path,
        config: dict,
        working_dir: Path,
        progress_callback: ProgressCallback,
    ) -> Path:
        from app.pipelines.pipeline_a_indirect.multiview_renderer import render_multiview
        from app.pipelines.pipeline_a_indirect.image_stylizer import stylize_images
        from app.pipelines.pipeline_a_indirect.reconstructor import reconstruct_3d

        num_views = config.get("num_views", 8)
        resolution = config.get("render_resolution", 512)
        prompt = config.get("prompt", "")
        strength = config.get("stylization_strength", 0.55)
        recon_method = config.get("reconstruction_method", "triposr")
        negative_prompt = config.get("negative_prompt", "blurry, low quality, distorted")

        intermediate_dir = working_dir / "intermediate"
        output_dir = working_dir / "output"
        intermediate_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Stage 1: Render multi-view images
        await progress_callback("render_views", 0.0, None)
        rendered_images = await render_multiview(
            model_path=input_model_path,
            output_dir=intermediate_dir / "renders",
            num_views=num_views,
            resolution=resolution,
        )
        await progress_callback("render_views", 1.0, {
            "rendered_views": [str(p) for p in rendered_images]
        })

        # Stage 2: Stylize images via Google Imagen
        await progress_callback("stylize_images", 0.0, None)
        styled_images = await stylize_images(
            input_images=rendered_images,
            prompt=prompt,
            negative_prompt=negative_prompt,
            strength=strength,
            output_dir=intermediate_dir / "styled",
            progress_callback=lambda frac: progress_callback("stylize_images", frac, None),
        )
        await progress_callback("stylize_images", 1.0, {
            "styled_views": [str(p) for p in styled_images]
        })

        # Stage 3: Reconstruct 3D
        await progress_callback("reconstruct_3d", 0.0, None)
        output_model_path = await reconstruct_3d(
            styled_images=styled_images,
            method=recon_method,
            output_dir=output_dir,
        )
        await progress_callback("reconstruct_3d", 1.0, {
            "output_model": str(output_model_path)
        })

        # Stage 4: Post-process
        await progress_callback("postprocess", 0.5, None)
        await progress_callback("postprocess", 1.0, None)

        return output_model_path
