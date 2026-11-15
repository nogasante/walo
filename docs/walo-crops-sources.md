# Walɔ crop knowledge base to sources and confidence

Generated 2026-11-14 10:25 (Africa/Accra, GMT). These are the source notes for the crop knowledge base the app ships as `app/data/crops.json`, built from saved raw data (EcoCrop CSV, FAO crop-calendar API responses, FAOSTAT bulk file, WFP/HDX prices).

**Rules.** Every value in the JSON carries source ids. `not confirmed` means no source was found in this session, so the app must not show it as fact. EcoCrop values are global ranges for the species, not Ghana-specific. FAO calendar dates are FAO's zone-level calendar for Ghana, last updated in 2021. Twi names come from a language-learning site and one academic table, so **a Twi speaker must check them before they go in the app**.

## District → agro-ecological zone

- **Ejura-Sekyedumase (Ashanti)**: Transitional zone (FAO_AEZ). FAO describes the Transitional zone as the northern parts of Ashanti and Brong-Ahafo.
- **Techiman (Bono East, formerly Brong-Ahafo)**: Transitional zone (FAO_AEZ). Mapped by FAO's region description (northern Brong-Ahafo); Techiman sits near the forest-transition boundary to verify locally.
- **Tamale (Northern Region)**: Guinea savanna zone (FAO_AEZ). FAO: Guinea savanna covers Northern, Upper East and Upper West; single rainy season Jun-Oct.

## Crops included

| Crop | Confidence | Twi (sourced) | Price series (Ejura / Kumasi / Techiman / Tamale) |
|---|---|---|---|
| Maize (*Zea mays*) | high | aburoo / aburow | ✓ / ✓ / ✓ / ✓ |
| Cowpea (*Vigna unguiculata*) | high (north) / medium (Ejura, Techiman) | adua (generic word for 'bean'; no cowpea-specific Twi term confirmed) | ✓ / ✓ / ✓ / ✓ |
| Groundnut (peanut) (*Arachis hypogaea*) | high (north) / medium (transition) | nkateɛ | to / to / ✓ / to |
| Cassava (*Manihot esculenta*) | high | bankye | ✓ / ✓ / ✓ / ✓ |
| Yam (white yam) (*Dioscorea rotundata*) | medium | bayerɛ | ✓ / ✓ / ✓ / ✓ |
| Sorghum (guinea corn) (*Sorghum bicolor*) | high (Tamale) / low (Ejura, Techiman) | not confirmed | ✓ / ✓ / ✓ / ✓ |
| Pearl millet (*Pennisetum glaucum*) | medium (Tamale) / low elsewhere | not confirmed | ✓ / ✓ / ✓ / ✓ |
| Rice (*Oryza sativa (also O. glaberrima)*) | medium | ɛmo | ✓ / ✓ / ✓ / ✓ |
| Soybean (*Glycine max*) | high (Tamale) / medium (transition) | not confirmed | ✓ / ✓ / ✓ / ✓ |
| Plantain (*Musa AAB group*) | medium (Ejura, Techiman) / low (Tamale) | borɔdeɛ / brode | ✓ / ✓ / ✓ / ✓ |
| Cocoyam (tannia) (*Xanthosoma sagittifolium*) | medium (forest) / low (Ejura, Tamale) | mankani / amankani (leaves: kontommire) | to / to / ✓ / to |
| Cocoa (*Theobroma cacao*) | medium (perennial tree crop; not a seasonal planting decision) | not confirmed | to / to / to / to |
| Tomato (*Solanum lycopersicum*) | medium | ntoosi / nɛnkyemɔɔno | ✓ / ✓ / ✓ / ✓ |
| Hot pepper (chilli) (*Capsicum annuum / C. frutescens*) | medium | mako | ✓ / ✓ / ✓ / ✓ |
| Onion (*Allium cepa*) | low-medium (MoFA guide internally inconsistent) | gyeene | ✓ / ✓ / ✓ / ✓ |
| Okra (*Abelmoschus esculentus*) | low-medium | nkuruma | to / to / to / to |
| Garden egg (African eggplant) (*Solanum aethiopicum*) | low-medium | nyaadewa | ✓ / ✓ / ✓ / ✓ |
| Sweet potato (*Ipomoea batatas*) | low-medium | not confirmed | to / to / to / to |
| Cashew (*Anacardium occidentale*) | low-medium (perennial tree crop) | not confirmed | to / to / to / to |
| Shea (*Vitellaria paradoxa*) | low (wild/parkland tree; not a planting recommendation) | not confirmed | to / to / to / to |

✓ means at least one price series exists (WFP/HDX to Jul 2023, or MoFA SRID/GCX rows in the Walɔ price file). Groundnut has no WFP series in any of the four markets, only MoFA SRID Techiman rows from 2025.

## Field → source matrix

| Crop | zones_ghana | days_to_maturity | rainfall | temperature | heat_stress | soil | drought_tolerance | yields_ghana | pests_diseases | planting windows |
|---|---|---|---|---|---|---|---|---|---|---|
| Maize | MOFA_MAIZE | MOFA_MAIZE, IITA_MAIZE_2025 | IITA_MAIZE_2025 | MOFA_MAIZE, IITA_MAIZE_2025 | LOBELL_2011 | MOFA_MAIZE, IITA_MAIZE_2025 | IITA_MAIZE_2025, MOFA_MAIZE | FAOSTAT, MOFA_MAIZE | MOFA_MAIZE, IITA_MAIZE_2025, MOFA_AFLATOXIN | APNI_MAIZE_NG, FAO_CROPCAL, MOFA_MAIZE |
| Cowpea | SARI_COWPEA | SARI_COWPEA, SONGOTRA_2026 | SARI_COWPEA | SARI_COWPEA | **not confirmed** | SARI_COWPEA | SARI_COWPEA, ECOCROP | FAOSTAT, SARI_COWPEA, SONGOTRA_2026 | SARI_COWPEA | AFRICARISING_2012, FAO_CROPCAL, SARI_COWPEA |
| Groundnut (peanut) | FAO_AEZ, FAO_CROPCAL | APNI_GNUT_NG | **not confirmed** | **not confirmed** | **not confirmed** | APNI_GNUT_NG | **not confirmed** | FAOSTAT, APNI_GNUT_NG | APNI_GNUT_NG, MOFA_AFLATOXIN | APNI_GNUT_NG, FAO_CROPCAL |
| Cassava | FAO_CROPCAL | IITA_CASSAVA, FAO_CROPCAL | FAO_CROPCAL | **not confirmed** | **not confirmed** | IITA_CASSAVA | **not confirmed** | IITA_CASSAVA, FAOSTAT | IITA_CASSAVA | FAO_CROPCAL |
| Yam (white yam) | FAO_CROPCAL | IITA_YAM, FAO_CROPCAL | FAO_CROPCAL | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | FAOSTAT | IITA_YAM | FAO_CROPCAL, IITA_YAM |
| Sorghum (guinea corn) | IITA_SORGHUM_2025 | IITA_SORGHUM_2025 | IITA_SORGHUM_2025 | IITA_SORGHUM_2025 | IITA_SORGHUM_2025 | IITA_SORGHUM_2025 | IITA_SORGHUM_2025 | IITA_SORGHUM_2025, FAOSTAT | IITA_SORGHUM_2025 | FAO_CROPCAL, IITA_SORGHUM_2025 |
| Pearl millet | MILLET_AJPS_2021 | MILLET_AJPS_2021 | MILLET_AJPS_2021 | **not confirmed** | **not confirmed** | **not confirmed** | MILLET_AJPS_2021 | MILLET_AJPS_2021, FAOSTAT | MILLET_AJPS_2021 | **not confirmed** |
| Rice | MOFA_RICE | MOFA_RICE | FAO_CROPCAL, MOFA_RICE | **not confirmed** | **not confirmed** | MOFA_RICE | ECOCROP | FAOSTAT, MOFA_RICE | MOFA_RICE | FAO_CROPCAL |
| Soybean | FAO_CROPCAL, APNI_SOY_NG | APNI_SOY_NG | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | APNI_SOY_NG, FAOSTAT | APNI_SOY_NG | APNI_SOY_NG, FAO_CROPCAL |
| Plantain | PLANTAIN_GH_2007 | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | FAOSTAT | PLANTAIN_GH_2007 | PLANTAIN_GH_2007 |
| Cocoyam (tannia) | ONYEKA_2014 | FAO_CROPCAL | FAO_CROPCAL | **not confirmed** | **not confirmed** | ONYEKA_2014 | ONYEKA_2014 | ONYEKA_2014 | ONYEKA_2014 | FAO_CROPCAL |
| Cocoa | COCOBOD_MANUAL | COCOBOD_MANUAL | COCOBOD_MANUAL | COCOBOD_MANUAL | **not confirmed** | COCOBOD_MANUAL | COCOBOD_MANUAL | FAOSTAT | COCOBOD_MANUAL | COCOBOD_MANUAL |
| Tomato | MOFA_TOMATO | FAO_CROPCAL | MOFA_TOMATO | MOFA_TOMATO | **not confirmed** | MOFA_TOMATO | MOFA_TOMATO | MOFA_TOMATO, FAOSTAT | MOFA_TOMATO | FAO_CROPCAL, MOFA_TOMATO |
| Hot pepper (chilli) | **not confirmed** | **not confirmed** | MOFA_PEPPER | MOFA_PEPPER | **not confirmed** | MOFA_PEPPER | **not confirmed** | FAOSTAT | MOFA_PEPPER | FAO_CROPCAL |
| Onion | **not confirmed** | MOFA_ONION | MOFA_ONION | MOFA_ONION | **not confirmed** | MOFA_ONION | **not confirmed** | MOFA_ONION, FAOSTAT | MOFA_ONION | FAO_CROPCAL |
| Okra | **not confirmed** | FAO_CROPCAL | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | FAOSTAT | OKRA_UG | FAO_CROPCAL |
| Garden egg (African eggplant) | GARDENEGG_IJAE, GARDENEGG_BER_2024 | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | FAOSTAT | GARDENEGG_IJAE, GARDENEGG_BER_2024 | FAO_CROPCAL |
| Sweet potato | FAO_CROPCAL | FAO_CROPCAL | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | FAOSTAT | SP_WEEVIL_GH | FAO_CROPCAL |
| Cashew | FAO_CROPCAL | CASHEW_GIZ_TECA | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | FAOSTAT | **not confirmed** | FAO_CROPCAL |
| Shea | SHEA_NASARE_2025 | SHEA_NASARE_2025 | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | **not confirmed** | FAOSTAT | **not confirmed** | **not confirmed** |

Every crop also has an `ecocrop` block (ECOCROP: temperature, annual rainfall, pH, cycle length, texture) and a `faostat` block (FAOSTAT yields 2020-2024 with flags).

## Key gaps and cautions

- **Twi names:** none are confirmed for sorghum, millet, soybean, cocoa, sweet potato, cashew or shea. For cowpea there is only the general word *adua* ('bean'). The rest come from LearnAkan and the Gyasi (1999) table, so a native speaker should check them.
- **Millet and plantain:** no verified planting dates. The FAO Ghana calendar has no entry for millet or plantain. Plantain days to maturity are also not confirmed.
- **Transition-zone figures (Ejura, Techiman) for sorghum, soybean, groundnut and cowpea** come only from the FAO calendar. The detailed Ghana guides (APNI/SARI, IITA) are written for northern Ghana.
- **Mm and °C thresholds:** Ghana-specific figures are missing for groundnut, cassava, yam, millet, soybean, plantain, okra, garden egg, sweet potato, cashew and shea. Only global EcoCrop ranges are available for them.
- **Inconsistent sources:** the MoFA onion guide contradicts itself on rainfall and temperature, and the pepper guide does the same on rainfall. The FAO cassava growing period (180-210 d) conflicts with IITA's 9-18 months. EcoCrop's sorghum rainfall (300-700 mm) is lower than Ghana practice.
- **FAOSTAT yields** from recent years are mostly FAO estimates (flag E). Sweet potato (~1.8 t/ha) looks implausibly low, and okra (~21.9 t/ha) and dry chilli look implausibly high. Cocoyam is mapped to the FAOSTAT item 'Taro', which is an assumption.
- **Prices:** WFP series stop in July 2023. There is no price series for okra, sweet potato, cashew, shea or cocoa (cocoa has a COCOBOD fixed producer price). There is no groundnut series for Ejura, Kumasi or Tamale. The Walɔ price CSV has no Tamale rows, so Tamale availability here was checked directly in WFP/HDX.
- **Pests:** none confirmed for cashew or shea. Sweet potato virus diseases are not confirmed.
- **Cocoa, cashew and shea** are perennial tree crops, so they don't fit a planting-window or rotation model. Shea is a wild parkland tree and shouldn't be recommended for planting.

## Dropped crops

No candidate crop was dropped completely. Shea, cashew, cocoa and sweet potato are kept at low confidence, and the JSON says what they can't support. Crops outside the brief (oil palm, sesame, cotton, cabbage) were not researched.

## Source list

- **ECOCROP**: FAO EcoCrop crop ecological requirements database (full table EcoCrop_DB.csv, as redistributed by OpenCLIM/ecocrop; field definitions per CGIAR Climate Data Hub catalog). *FAO (EcoCrop); redistributed by OpenCLIM / UKCEH*. <https://github.com/OpenCLIM/ecocrop/blob/main/EcoCrop_DB.csv>. Note: Global, species-level, not Ghana-specific. Rainfall fields (RMIN/ROPMN/ROPMX/RMAX) are recorded by EcoCrop as annual totals (see https://cgiar-climate-data-hub.github.io/catalog/ecocrop/). Temperature = absolute min/max and optimal min/max (°C).
- **FAO_CROPCAL**: FAO Crop Calendar to Ghana (per agro-ecological zone; last updated 26/02/2021). *FAO*. <https://cropcalendar.apps.fao.org/>. Note: Raw API responses saved in walo-crops-build/faocal/. FAO crop id 0113 is returned under the name 'Corn, sweet' but is the id FAO lists as 'Maize' for Ghana.
- **FAO_AEZ**: FAO Crop Calendar to Ghana agro-ecological zones (Coastal savanna, Rain forest, Transitional, Guinea savanna). *FAO*. <https://api-cropcalendar.apps.fao.org/api/v1/countries/GH/aez?language=en>. Note: Transitional zone = northern Ashanti and Brong-Ahafo, rain 1000-1300 mm, major season Apr-Aug, minor Sep-Nov. Guinea savanna = Northern/Upper East/Upper West, 750-1000 mm, single season Jun-Oct (FAO text).
- **FAOSTAT**: FAOSTAT Crops and livestock products (QCL), Africa bulk file, Ghana, 2020-2024. *FAO Statistics Division*. <https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_Africa.zip>. Note: Flags: A=official, X=from international org, E=estimated, I=imputed. Many recent Ghana yields are FAO estimates (E).
- **WFP_HDX**: WFP Food Prices for Ghana (wfp_food_prices_gha.csv). *WFP via Humanitarian Data Exchange (HDX)*. <https://data.humdata.org/dataset/wfp-food-prices-for-ghana>. Note: Observations end 15 Jul 2023 for these markets.
- **WALO_PRICES**: Walɔ crop price file /workspace/walo-ghana-crop-prices.csv (WFP rows plus MoFA SRID 2025 Techiman, GCX 2024-2026, news). *Team Simply Zero compilation*. <file:/workspace/walo-ghana-crop-prices.csv>. Note: Does not contain Tamale rows; Tamale availability below is from WFP_HDX directly.
- **MOFA_MAIZE**: Guide to Maize Production (Planting for Food and Jobs IEC series). *Ministry of Food and Agriculture (MoFA), Directorate of Agricultural Extension Services, Ghana*. <https://mofa.gov.gh/site/images/pdf/production_guides/GUIDE_TO_MAIZE_PRODUCTION.pdf>
- **MOFA_TOMATO**: Tomato Production Guide. *MoFA Ghana (DAES)*. <https://mofa.gov.gh/site/images/pdf/production_guides/TOMATO_Production_Guide.pdf>
- **MOFA_PEPPER**: Pepper Production Guide. *MoFA Ghana (DAES)*. <https://mofa.gov.gh/site/images/pdf/production_guides/Pepper_Production.pdf>. Note: Guide states two different rainfall figures (600-1,250 mm annual, and 300-600 mm well distributed).
- **MOFA_ONION**: Onion Production Guide. *MoFA Ghana (DAES)*. <https://mofa.gov.gh/site/images/pdf/production_guides/onion_production_guide.pdf>. Note: LOW internal consistency: the 'growing requirements' paragraph appears copied from the pepper guide and the guide gives both 600-1,250 mm and 300-600 mm rainfall and both 18-32 °C and 24-32 °C.
- **MOFA_RICE**: Rice Production Guide. *MoFA Ghana (DAES)*. <https://mofa.gov.gh/site/images/pdf/production_guides/RICE_Production_Guide.pdf>
- **MOFA_AFLATOXIN**: Aflatoxin Contamination in Groundnut and Maize in Ghana (production guide). *MoFA Ghana*. <https://mofa.gov.gh/site/images/pdf/production_guides/Aflatoxin_Contamination_In_Groundnut_And_Maize.pdf>
- **IITA_MAIZE_2025**: Abdul Rahman N., Kotu B., Ortega-Beltran A., Adjei-Nsiah S., Agbetiameh D., Buah S.S.J. (2025). Guide for sustainable maize production in Ghana. *IITA (with CSIR-SARI, KNUST, MoFA)*. <https://cgspace.cgiar.org/server/api/core/bitstreams/40fbec24-8696-4f7d-b2d1-f6ade042ac7a/content>
- **IITA_SORGHUM_2025**: Abdul Rahman N., Kotu B., Buah S.S.J. (2025). Guide for sustainable sorghum production in Ghana. *IITA (with CSIR-SARI)*. <https://cgspace.cgiar.org/server/api/core/bitstreams/f75202b0-ecbc-4773-8ee3-b799e2d59a2d/content>
- **APNI_MAIZE_NG**: Njoroge S. et al. Maize Cropping Guide to 4R Nutrient Management and Best Agronomic Practices, Northern Ghana. *African Plant Nutrition Institute (APNI) & CSIR-SARI*. <https://www.apni.net/wp-content/uploads/2023/06/4R-Maize-Guide-N-Ghana.pdf>
- **APNI_GNUT_NG**: Groundnut Cropping Guide to 4R Nutrient Management and Best Agronomic Practices, Northern Ghana. *APNI & CSIR-SARI*. <https://www.apni.net/wp-content/uploads/2023/06/4R-Groundnut-Guide-N-Ghana.pdf>
- **APNI_SOY_NG**: Soybean Cropping Guide to 4R Nutrient Management and Best Agronomic Practices, Northern Ghana. *APNI & CSIR-SARI*. <https://www.apni.net/wp-content/uploads/2023/06/4R-Soybean-Guide-N-Ghana.pdf>
- **SARI_COWPEA**: Production guide on cowpea (Vigna unguiculata (L.) Walp). *CSIR-Savanna Agricultural Research Institute (SARI) blog, 4 Dec 2012*. <https://csirsavannah.wordpress.com/2012/12/04/production-guide-on-cowpea-vigna-unguiculata-l-walp/>
- **AFRICARISING_2012**: Annual Report of Africa RISING subprojects carried out by CSIR-SARI, Jul-Dec 2012 (cowpea planting-date results, preliminary). *CGIAR / IITA Africa RISING; CSIR-SARI*. <https://hdl.handle.net/10568/25201>
- **SONGOTRA_2026**: The Yield and Pest Trade-Off: Insecticide Spray Frequency on a Genetically Modified Cowpea in Ghana. Agronomy 16(2):156. *MDPI (peer-reviewed)*. <https://doi.org/10.3390/agronomy16020156>
- **IITA_CASSAVA**: James B., Yaninek J., Tumanteh A., Maroya N., Dixon A., Salawu R., Kwarteng J. Starting a Cassava Farm to IPM Field Guide for Extension Agents (ESCaPP project with MoFA Ghana and others). *IITA*. <https://cgspace.cgiar.org/server/api/core/bitstreams/235db80f-e404-414e-8a18-579377a84479/content>
- **IITA_YAM**: Yam (crop page). *IITA*. <https://iita.org/yam/>
- **COCOBOD_MANUAL**: Manual for Cocoa Extension in Ghana. *Ghana Cocoa Board (COCOBOD), Cocoa Health and Extension Division (with WCF, USAID, IDH)*. <https://cgspace.cgiar.org/server/api/core/bitstreams/48c5a0b9-c71b-4c86-9869-e76f5f0d0ea8/content>
- **ONYEKA_2014**: Onyeka J. (2014). Status of Cocoyam (Colocasia esculenta and Xanthosoma spp.) in West and Central Africa: Production, Household Importance and the Threat from Leaf Blight. *CGIAR Research Program on Roots, Tubers and Bananas (RTB)*. <https://cgspace.cgiar.org/server/api/core/bitstreams/6675eefa-76f5-44a3-8b33-72b0a289e62e/content>
- **PLANTAIN_GH_2007**: Plantain Production Practices in the Ashanti, Brong-Ahafo and Eastern Regions of Ghana. Asian Journal of Agricultural Research 1(1):1-9 (2007). *Science Alert (peer-reviewed journal; CSIR-CRI authors)*. <https://scialert.net/fulltext/?doi=ajar.2007.1.9>
- **MILLET_AJPS_2021**: Assessing production constraints, management and use of pearl millet in the Guinea Savanna agro-ecology of Ghana. African Journal of Plant Science 15(11):288-298, doi:10.5897/AJPS2021.2183. *Academic Journals (CSIR-SARI authors)*. <https://academicjournals.org/journal/AJPS/article-full-text-pdf/9C878B568237>
- **SP_WEEVIL_GH**: Agbessenou A. Sweetpotato weevils (Cylas puncticollis, C. brunneus) to farmer brochure, Ghana. *Royal Belgian Institute of Natural Sciences (taxonomy.naturalsciences.be); refers to CSIR-CRI, MoFA PPRSD, Univ. of Ghana*. <https://taxonomy.naturalsciences.be/wp-content/uploads/2021/09/Sweet_potato_weevil_brochure_ghana_EN.pdf>
- **CASHEW_GIZ_TECA**: Guide to harvesting and post-harvest handling of cashew nuts (country of first practice: Ghana). *GIZ African Cashew Initiative, via FAO TECA*. <https://openknowledge.fao.org/server/api/core/bitstreams/fbb465d0-5663-43ed-a9c0-52cd414555b1/content>
- **SHEA_NASARE_2025**: Nasare L.I., Kwapong P.K., Stout J.C. (2025). Geographic variation in shea floral phenology and morphology in the Guinea savanna zone of Ghana. Ghana J. Sci. Tech. Dev. 11(2). *University for Development Studies, Tamale et al. (peer-reviewed)*. <https://gjstd.org/index.php/GJSTD/article/download/497/199>
- **OKRA_UG**: Biopesticide Control of Some Important Okra Insect-Pests and Viral Diseases in Three Okra Cultivars (thesis). *University of Ghana (UGSpace)*. <https://ugspace.ug.edu.gh/items/42341ea4-7fc2-4e25-9faf-27832e0590b8>
- **GARDENEGG_IJAE**: Amengor et al. Reconnaissance study of insect-pest infestation of garden eggs in the Volta Region of Ghana. International Journal of Agricultural Extension. *ESci Journals (peer-reviewed)*. <https://esciencepress.net/journals/IJAE/article/view/1885>
- **GARDENEGG_BER_2024**: First report of Leucinodes africensis and Leucinodes laisalis on Solanum aethiopicum and S. melongena in farmers' fields in southern Ghana. Bulletin of Entomological Research (2024). *Cambridge University Press*. <https://doi.org/10.1017/s0007485324000154>
- **LOBELL_2011**: Lobell D.B., Bänziger M., Magorokosho C., Vivek B. (2011). Nonlinear heat effects on African maize as evidenced by historical yield trials. Nature Climate Change 1:42-45. *Nature Publishing Group*. <https://www.nature.com/articles/nclimate1043>
- **TWI_LEARNAKAN**: Twi Food Vocabulary (Fruits, Vegetables, Grains). *LearnAkan (language-learning website)*. <https://learnakan.com/twi-food-vocabulary/>. Note: Non-academic; spellings should be checked by a Twi speaker.
- **TWI_GYASI_CBD**: Gyasi (1999) table of plants in a home garden at Gyamfiase-Adenya, Ghana (local Twi names), PLEC West Africa tables. *Convention on Biological Diversity (cbd.int)*. <https://www.cbd.int/doc/nbsap/agriculture/WestAfricaTables.pdf>
