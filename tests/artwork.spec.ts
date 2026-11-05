import { test, expect } from "@playwright/test";
import { dominantTone } from "../src/useArtworkTone";

test("une majorité de jaunes proches gagne sur une minorité bleue uniforme", () => {
  const pixels: number[] = [];
  for (let i = 0; i < 70; i++)
    pixels.push(225 + (i % 20), 175 + (i % 20), 22 + (i % 8), 255);
  for (let i = 0; i < 30; i++) pixels.push(0, 159, 227, 255);
  const [r, g, b] = dominantTone(new Uint8ClampedArray(pixels))!
    .split(" ")
    .map(Number);
  expect(r).toBeGreaterThan(220);
  expect(g).toBeGreaterThan(170);
  expect(b).toBeLessThan(40);
});

test("gris et blanc restent neutres ; aucune couleur inventée sans pixels lisibles", () => {
  expect(dominantTone(new Uint8ClampedArray([160, 160, 160, 255]))).toBe(
    "160 160 160",
  );
  expect(dominantTone(new Uint8ClampedArray([255, 255, 255, 255]))).toBe(
    "255 255 255",
  );
  expect(dominantTone(new Uint8ClampedArray([0, 159, 227, 0]))).toBeNull();
});
