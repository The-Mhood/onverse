/* Test-only CLI adapter. No app linkage. Upstream source/licenses stay external.
 * Input: little-endian interleaved IEEE-754 float32, exact declared frame count.
 * Loudness is queried before zero extension used ONLY to flush peak filter tail.
 */
#include "ebur128.h"
#include <errno.h>
#include <float.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void fail(const char *message) {
  fprintf(stderr, "reference error: %s\n", message);
  exit(2);
}

static unsigned long number(const char *text) {
  char *end;
  unsigned long value;
  if (!text[0]) fail("empty integer");
  for (const char *p = text; *p; ++p)
    if (*p < '0' || *p > '9') fail("expected unsigned decimal integer");
  errno = 0;
  value = strtoul(text, &end, 10);
  if (errno || *end || !value) fail("integer out of range");
  return value;
}

static void check(int code) {
  if (code != EBUR128_SUCCESS) {
    fprintf(stderr, "reference error: libebur128 code %d\n", code);
    exit(2);
  }
}

static void json_number(double value) {
  if (isfinite(value)) printf("%.17g", value);
  else printf("null");
}

int main(int argc, char **argv) {
  if (argc != 6 && argc != 7)
    fail("usage: reference pcm-file sample-rate channels frames chunk-frames [peak-tail-frames]");
  const unsigned long rate = number(argv[2]);
  const unsigned long channels = number(argv[3]);
  const unsigned long frames = number(argv[4]);
  const unsigned long chunk = number(argv[5]);
  const unsigned long tail = argc == 7 ? number(argv[6]) : 64;
  if (tail < 64 || tail > 1024) fail("peak tail must be between 64 and 1024 frames");
  if (rate != 44100 && rate != 48000) fail("unsupported sample rate");
  if (channels != 1 && channels != 2) fail("unsupported channel layout");
  if (frames > rate * 30 || chunk > rate * 30) fail("test-only 30-second limit exceeded");
  if (sizeof(float) != 4 || FLT_RADIX != 2 || FLT_MANT_DIG != 24 || FLT_MAX_EXP != 128)
    fail("IEEE-754 float32 host required");

  FILE *input = fopen(argv[1], "rb");
  if (!input) fail("cannot open input file");
  const size_t capacity = (chunk < frames ? chunk : frames) * channels;
  unsigned char *bytes = malloc(capacity * 4);
  float *pcm = malloc(capacity * sizeof(float));
  if (!bytes || !pcm) fail("allocation failed");
  ebur128_state *state = ebur128_init((unsigned int)channels, rate,
                                     EBUR128_MODE_I | EBUR128_MODE_TRUE_PEAK);
  if (!state) fail("cannot initialize reference state");
  check(ebur128_set_channel(state, 0, channels == 1 ? EBUR128_CENTER : EBUR128_LEFT));
  if (channels == 2) check(ebur128_set_channel(state, 1, EBUR128_RIGHT));

  for (unsigned long off = 0; off < frames;) {
    const unsigned long take = chunk < frames - off ? chunk : frames - off;
    const size_t samples = take * channels;
    if (fread(bytes, 1, samples * 4, input) != samples * 4) fail("truncated input");
    for (size_t i = 0; i < samples; ++i) {
      const unsigned char *p = bytes + i * 4;
      const uint32_t bits = (uint32_t)p[0] | ((uint32_t)p[1] << 8) |
                            ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
      memcpy(pcm + i, &bits, 4);
      if (!isfinite(pcm[i])) fail("nonfinite PCM sample");
    }
    check(ebur128_add_frames_float(state, pcm, take));
    off += take;
  }
  if (fgetc(input) != EOF || ferror(input)) fail("extra input or read error");
  if (fclose(input)) fail("input close failed");

  double lufs;
  check(ebur128_loudness_global(state, &lufs));
  if (isnan(lufs) || lufs == INFINITY) fail("invalid reference loudness");
  const char *status = frames < rate * 4 / 10 ? "insufficient-duration" :
                       isfinite(lufs) ? "valid" : "below-gate";
  if (!strcmp(status, "valid") && !isfinite(lufs)) fail("invalid valid status");

  /* At these rates upstream uses a 49-tap interpolator. 64 input zero frames
   * exceed its finite support. Do NOT include them in integrated loudness.
   */
  float zeros[64 * 2] = {0};
  for (unsigned long flushed = 0; flushed < tail;) {
    const unsigned long take = tail - flushed < 64 ? tail - flushed : 64;
    check(ebur128_add_frames_float(state, zeros, take));
    flushed += take;
  }
  double sample_peak[2] = {0}, true_peak[2] = {0}, sp = 0, tp = 0;
  for (unsigned long c = 0; c < channels; ++c) {
    check(ebur128_sample_peak(state, (unsigned int)c, sample_peak + c));
    check(ebur128_true_peak(state, (unsigned int)c, true_peak + c));
    if (!isfinite(sample_peak[c]) || !isfinite(true_peak[c]) ||
        sample_peak[c] < 0 || true_peak[c] < sample_peak[c]) fail("invalid reference peak");
    if (sample_peak[c] > sp) sp = sample_peak[c];
    if (true_peak[c] > tp) tp = true_peak[c];
  }
  int major, minor, patch;
  ebur128_get_version(&major, &minor, &patch);
  printf("{\"libraryVersion\":\"%d.%d.%d\",\"sampleRate\":%lu,\"channels\":%lu,"
         "\"inputFrames\":%lu,\"chunkFrames\":%lu,\"peakTailFrames\":%lu,"
         "\"loudnessStatus\":\"%s\",\"lufs\":", major, minor, patch, rate,
         channels, frames, chunk, tail, status);
  json_number(!strcmp(status, "valid") ? lufs : NAN);
  printf(",\"samplePeakLinear\":"); json_number(sp);
  printf(",\"truePeakLinear\":"); json_number(tp);
  printf(",\"samplePeakDb\":"); json_number(sp > 0 ? 20 * log10(sp) : NAN);
  printf(",\"truePeakDb\":"); json_number(tp > 0 ? 20 * log10(tp) : NAN);
  printf(",\"channelSamplePeaks\":[");
  for (unsigned long c = 0; c < channels; ++c) {
    if (c) printf(",");
    json_number(sample_peak[c]);
  }
  printf("],\"channelTruePeaks\":[");
  for (unsigned long c = 0; c < channels; ++c) {
    if (c) printf(",");
    json_number(true_peak[c]);
  }
  printf("]}\n");
  ebur128_destroy(&state);
  free(bytes);
  free(pcm);
  return ferror(stdout) ? 2 : 0;
}
