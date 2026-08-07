# src/api/schemas.py
from pydantic import BaseModel, Field

class CrossoverSettingsSchema(BaseModel):
    low_cutoff_hz: float = Field(200.0, description="Frequência de corte entre sub-graves e médios")
    high_cutoff_hz: float = Field(3000.0, description="Frequência de corte entre médios e agudos")

class StereoProcessingSettings(BaseModel):
    saturation_amount: float = Field(0.3, ge=0.0, le=1.0, description="Intensidade de calor analógico lateral")
    stereo_width: float = Field(1.0, ge=0.5, le=2.0, description="Fator de largura de campo estéreo")
    mono_bass_frequency_hz: float = Field(120.0, ge=80.0, le=200.0, description="Corte do mono bass")

class LimiterSettingsSchema(BaseModel):
    ceiling_dbtp: float = Field(-1.0, ge=-3.0, le=-0.1, description="Teto de pico verdadeiro máximo exigido pelas plataformas")
    threshold_db: float = Field(0.0, ge=-18.0, le=0.0, description="Nível de redução de dinâmica e densidade de volume")
