# How to use the Walo proof script

A short guide for the team. You do not need to be a programmer.

## What this script does

It asks NASA, live, for the weather at one exact place on the map.

It prints the usual rain and temperature, then compares the last ten years with the ten years before that.

It uses the same planting rules as the Walo app (FAO crop calendar, onset of rains, water need, heat limit).

It prints the exact NASA web address it used, so anyone can open it and see the same numbers.

## How to run it

Open a terminal in this folder (`proof`) and type:

```
python3 walo_proof.py
```

From the repository root the same command is `python3 proof/walo_proof.py`.

That uses the default place (Ejura) and the default crop (maize). It takes a few seconds and needs internet. If there is no internet, it says so clearly and stops. The script reads the app's bundled climate from `app/data` when that folder is beside `proof`.

## How to change the location

There are two easy ways.

**Way 1 — pick a saved town.** These towns are already in the script, with the same coordinates the app uses: Ejura (also called Ejura-Sekyedumase), Tamale, Techiman, Kumasi, Accra.

```
python3 walo_proof.py --place Tamale
python3 walo_proof.py --place Techiman
python3 walo_proof.py --place Kumasi
```

**Way 2 — type any point.** Use a latitude and a longitude (north and west numbers). This is how you show a farmer's exact field.

```
python3 walo_proof.py --lat 9.4008 --lon -0.8393 --name Tamale
```

You can also open `walo_proof.py` in a text editor and change the SETTINGS block at the top (`PLACE_NAME`, or `LAT` and `LON`), then run `python3 walo_proof.py` with no flags.

## How to change the crop

```
python3 walo_proof.py --crop rice
python3 walo_proof.py --place Tamale --crop maize
```

Or change `CROP` in the SETTINGS block at the top of the script. Names the app knows include maize, rice, cassava, cowpea, groundnut, sorghum, millet, soybean, yam, plantain, tomato, cocoa and cashew.

## What each printed section means

**The NASA URLs at the top.** These are the exact pages the script just asked. Open one in a browser during the check-in if you want to prove the numbers are not made up.

**1. Usual rain and temperature.** A typical year at this place, averaged over 1991–2025, the same years Walo uses. The little `#` bar is only a picture of how wet each month is. The year total should be very close to what the app shows for that town.

**2. Ten years ago compared with recently.** 2006–2015 versus 2016–2025, still from NASA, still for this exact point. This is the “then vs now” story. It belongs in the talk, not inside the app.

**3. Recent weather.** The last several weeks of daily NASA data. These values often lag a few days behind today.

**4. Good months for this crop.** The same rules Walo uses. If FAO has a crop calendar for this zone, those are the planting months. Then the script checks water need (FAO-56) and the crop's heat limit. The last line, “Same as the app shows”, is the short answer you can point to.

**5. Do these live numbers match the app?** Only appears for a saved town. It compares the live NASA download with the climate stored in the app. Small gaps of about 1 mm come from leap days, not from a different source.

## What to say to judges while it runs

1. “This is not a made-up climate table. The script is asking NASA POWER right now for this exact point — the same NASA source Walo is built on.”

2. “Here is the URL it just used. You can open it yourself and read the same rain and temperature.”

3. “The usual-year numbers match what you see in the app, because the app is averaging that same NASA record for 1991–2025.”

4. “The planting months are not a guess. They come from the FAO crop calendar and the same water and heat rules Walo uses. The app is the product; this script is only the proof that the data is real.”

If the internet fails, say: “NASA is the source. The app already has the 1991–2025 record saved from this same API, and we can show that instead.”

## If something goes wrong

- `python3: command not found` — try `python walo_proof.py`. You only need Python 3; there is nothing to install.
- “Could not reach NASA POWER” — check the wifi and run it again.
- The crop or place name is not recognised — check the spelling, or use `--lat` and `--lon` for a new point.
