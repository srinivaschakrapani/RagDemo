"""Curated ~50-label subset of the DailyMed SPL monthly-update dump used to
build the RAGDemo teaching corpus. Hand-picked (not random) across categories,
including two genuine look-alike/sound-alike (LASA) drug-name pairs used as
Compare-tab edge cases: hydrALAZINE vs hydrOXYzine, and clonazePAM vs
cloNIDine -- real confused-drug-name pairs, each pair having very different
indications, so a retrieval mix-up produces a visibly wrong answer.
"""

from __future__ import annotations

# (category, zip filename, expected drug name -- sanity-checked against the
# parsed XML, not trusted blindly)
LABELS: list[tuple[str, str, str]] = [
    # -- prescription (35) --------------------------------------------------
    ("prescription", "20260701_8b7e88ef-5edd-40df-8e43-e3f29970be58.zip", "Hydralazine Hydrochloride"),
    ("prescription", "20260711_b6189074-e199-4f58-a78d-c04f131c13d9.zip", "Hydroxyzine hydrochloride"),
    ("prescription", "20260704_3aa9c3eb-3a0a-4e8b-af68-4f87d87194dd.zip", "Clonazepam"),
    ("prescription", "20260704_2a183d05-5be7-43e9-a084-700ec05d01e9.zip", "clonidine hydrochloride"),
    ("prescription", "20260718_4ad016ec-e158-4325-9f45-4460cf78dd98.zip", "Amlodipine Besylate"),
    ("prescription", "20260709_17050df5-9e95-4e1b-ac75-34add289b139.zip", "Metformin hydrochloride"),
    ("prescription", "20260701_6062fd98-7663-f4b5-e053-2a91aa0acbc3.zip", "LISINOPRIL"),
    ("prescription", "20260701_41844c21-9e2a-4332-a8ff-9b71ae9032b0.zip", "Gabapentin"),
    ("prescription", "20260701_1e6f3ce7-e8a3-40e8-8437-523ef5277b2e.zip", "Ibuprofen"),
    ("prescription", "20260703_5590d36d-dbe7-1c78-e063-6294a90ad2d4.zip", "prednisone"),
    ("prescription", "20260703_4fb7837e-964c-4d38-a3a5-b384b1bd6e08.zip", "Amoxicillin"),
    ("prescription", "20260711_1d0d50ba-8c2c-855c-e063-6394a90a5c7d.zip", "Cephalexin"),
    ("prescription", "20260701_6518ba72-89e4-4f2f-b334-9ef759b696f8.zip", "Spironolactone"),
    ("prescription", "20260704_559fdce5-ab3e-0d02-e063-6394a90a7fbd.zip", "Quetiapine fumarate"),
    ("prescription", "20260702_8f485576-a4c4-45d4-816f-2e59fce9f517.zip", "olanzapine"),
    ("prescription", "20260702_3207cf04-73b7-24ce-e054-00144ff8d46c.zip", "Ondansetron"),
    ("prescription", "20260702_99886f54-4ebe-4a2d-b779-bcfbb0634db1.zip", "metronidazole"),
    ("prescription", "20260704_de7f61ca-e3c0-4a09-b664-0df2de6a0c30.zip", "Lamotrigine"),
    ("prescription", "20260701_fad03768-f1d2-459f-965e-0ec29f189f1f.zip", "Doxycycline Hyclate"),
    ("prescription", "20260701_6aaf08aa-9aa3-aabd-e053-2a91aa0a86d1.zip", "Trazodone Hydrochloride"),
    ("prescription", "20260701_35d3486c-c6ea-4d31-e063-6294a90a1219.zip", "Pregabalin"),
    ("prescription", "20260701_ae9954a5-e196-449c-abea-ebe4afbee517.zip", "Levothyroxine Sodium"),
    ("prescription", "20260702_d3497ad6-b549-4144-b57f-b2088ad80b09.zip", "Atorvastatin Calcium"),
    ("prescription", "20260701_25c93638-7016-47d2-a57c-e4a5245ca41b.zip", "Losartan Potassium"),
    ("prescription", "20260701_3dd83384-09b5-da46-e063-6394a90a558c.zip", "Sertraline"),
    ("prescription", "20260704_32afb28a-dc4c-4a7e-9701-1825f805e7df.zip", "Fluoxetine"),
    ("prescription", "20260701_2a5bcf50-6d63-463a-915e-a72ea2e5f131.zip", "Furosemide"),
    ("prescription", "20260703_db900453-4777-4142-a236-5d3a6152d0a5.zip", "Citalopram"),
    ("prescription", "20260702_39fa4247-e864-f653-e063-6394a90ac98d.zip", "Duloxetine"),
    ("prescription", "20260701_20281fe6-7db9-4b33-8418-b25e6a5404ca.zip", "Escitalopram"),
    ("prescription", "20260709_4203d3fe-916e-41af-9daf-f58f4fed6f9c.zip", "Alprazolam"),
    ("prescription", "20260702_333ffe63-aaeb-4dff-b595-1c11209189a6.zip", "Azithromycin"),
    ("prescription", "20260715_4caf49d9-b06f-4d57-aac3-cc64ae12cc95.zip", "ciprofloxacin"),
    ("prescription", "20260702_557d4c2c-5541-3a51-e063-6394a90ad278.zip", "Omeprazole"),
    ("prescription", "20260701_03429cec-c6b5-47fe-bb11-6b42f977df7e.zip", "Finasteride"),
    # -- otc (10) -------------------------------------------------------------
    ("otc", "20260701_4d830b9b-b396-9581-7572-c7f19ff17597.zip", "Ibuprofen"),
    ("otc", "20260701_4e08a7cb-3894-84c3-e063-6394a90a0b42.zip", "Acetaminophen"),
    ("otc", "20260703_0cca91cb-f05b-3cf8-e063-6394a90a9f79.zip", "Aspirin"),
    ("otc", "20260703_2bc586e4-5297-44cf-e063-6294a90a531d.zip", "Loratadine"),
    ("otc", "20260703_f2f42f36-6b09-4140-e053-2a95a90af813.zip", "Cetirizine Hydrochloride"),
    ("otc", "20260707_28ec213e-fabb-28ec-e063-6394a90ad102.zip", "Diphenhydramine HCl"),
    ("otc", "20260708_f4786707-a0f7-4ba8-9656-06278d1b4b6c.zip", "calcium carbonate"),
    ("otc", "20260711_5a464242-7d63-141e-808e-c41676cf4b78.zip", "Nicotine Polacrilex"),
    ("otc", "20260715_48ec3132-17cf-1de9-e063-6294a90aa407.zip", "Simethicone"),
    ("otc", "20260716_486838cd-17ee-c2df-4e05-aa6106dd8fd8.zip", "Lansoprazole"),
    # -- animal (2) -------------------------------------------------------------
    ("animal", "20260703_2be5a8d4-185e-40b4-800f-3cdbb2a1fa3c.zip", "Pimobendan"),
    ("animal", "20260703_84fe39b2-0423-479a-b81f-198e2fb4e826.zip", "IVOMEC"),
    # -- homeopathic (2) ----------------------------------------------------
    ("homeopathic", "20260701_fa0e82d1-0806-4256-82d2-8070336fbe1d.zip", "Leg Cramps"),
    ("homeopathic", "20260702_298db5de-1ca7-4172-e063-6294a90a0c33.zip", "Phytolacca e rad 6X"),
    # -- other (3) ------------------------------------------------------------
    ("other", "20260704_97db9c3c-20c2-4dad-890c-bc821805421f.zip", "KRESLADI"),
    ("other", "20260715_2157e11b-87c3-4d54-a225-81b341e4e21a.zip", "TREGZI"),
    ("other", "20260703_1158fa93-ef41-4a29-8252-9251f94c53c8.zip", "VAXNEUVANCE"),
]

# Genuine LASA (look-alike/sound-alike) pairs present in LABELS above, used to
# build verified Compare-tab edge cases once both pipelines are live (Phase 4).
LASA_PAIRS: list[tuple[str, str]] = [
    ("Hydralazine Hydrochloride", "Hydroxyzine hydrochloride"),
    ("Clonazepam", "clonidine hydrochloride"),
]
