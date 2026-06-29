(module
  (memory (export "memory") 1)

  ;; RYU constants
  (global $VIDEO_TIMESCALE i32 (i32.const 90000))
  (global $VIDEO_SAMPLE_DELTA i32 (i32.const 1500))

  ;; --- Big-endian read/write ---
  (func $rb32 (param $a i32) (result i32)
    (i32.or (i32.shl (i32.load8_u (local.get $a)) (i32.const 24))
    (i32.or (i32.shl (i32.load8_u (i32.add (local.get $a) (i32.const 1))) (i32.const 16))
    (i32.or (i32.shl (i32.load8_u (i32.add (local.get $a) (i32.const 2))) (i32.const 8))
    (i32.load8_u (i32.add (local.get $a) (i32.const 3)))))))

  (func $rb64 (param $a i32) (result i64)
    (i64.or (i64.shl (i64.extend_i32_u (call $rb32 (local.get $a))) (i64.const 32))
    (i64.extend_i32_u (call $rb32 (i32.add (local.get $a) (i32.const 4))))))

  (func $wb32 (param $a i32) (param $v i32)
    (i32.store8 (local.get $a) (i32.shr_u (local.get $v) (i32.const 24)))
    (i32.store8 (i32.add (local.get $a) (i32.const 1)) (i32.shr_u (local.get $v) (i32.const 16)))
    (i32.store8 (i32.add (local.get $a) (i32.const 2)) (i32.shr_u (local.get $v) (i32.const 8)))
    (i32.store8 (i32.add (local.get $a) (i32.const 3)) (local.get $v)))

  ;; --- Patch stts: set entry_count=1, sample_count=total, sample_delta=1500 ---
  (func $patchStts (param $dOff i32)
    (local $ec i32) (local $i i32) (local $ea i32)
    (local $sc i32) (local $sd i32) (local $ts i32)
    (local.set $ec (call $rb32 (i32.add (local.get $dOff) (i32.const 4))))
    (if (i32.eqz (local.get $ec)) (then (return)))
    (if (i32.gt_u (local.get $ec) (i32.const 100000)) (then (return)))
    ;; Sum sample counts
    (local.set $i (i32.const 0))
    (local.set $ts (i32.const 0))
    (block $done
      (loop $lp
        (br_if $done (i32.ge_u (local.get $i) (local.get $ec)))
        (local.set $ea (i32.add (i32.add (local.get $dOff) (i32.const 8))
          (i32.mul (local.get $i) (i32.const 8))))
        (local.set $sc (call $rb32 (local.get $ea)))
        (local.set $ts (i32.add (local.get $ts) (local.get $sc)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $lp)))
    (if (i32.eqz (local.get $ts)) (then (return)))
    (if (i32.gt_u (local.get $ts) (i32.const 1000000)) (then (return)))
    ;; Write: entry_count=1, sample_count=totalSamples, sample_delta=1500
    (call $wb32 (i32.add (local.get $dOff) (i32.const 4)) (i32.const 1))
    (call $wb32 (i32.add (local.get $dOff) (i32.const 8)) (local.get $ts))
    (call $wb32 (i32.add (local.get $dOff) (i32.const 12)) (global.get $VIDEO_SAMPLE_DELTA)))

  ;; --- Patch mdhd: set timescale=90000, duration=sampleCount*1500 ---
  (func $patchMdhd (param $dOff i32) (param $sampleCount i32)
    (local $ver i32) (local $tsOff i32) (local $durOff i32)
    (local.set $ver (i32.load8_u (local.get $dOff)))
    (if (local.get $ver)
      (then (local.set $tsOff (i32.add (local.get $dOff) (i32.const 20)))
            (local.set $durOff (i32.add (local.get $dOff) (i32.const 24))))
      (else (local.set $tsOff (i32.add (local.get $dOff) (i32.const 12)))
            (local.set $durOff (i32.add (local.get $dOff) (i32.const 16)))))
    ;; Write timescale = 90000
    (call $wb32 (local.get $tsOff) (global.get $VIDEO_TIMESCALE))
    ;; Write duration = sampleCount * 1500
    (call $wb32 (local.get $durOff) (i32.mul (local.get $sampleCount) (global.get $VIDEO_SAMPLE_DELTA)))
    ;; If v1, zero out the upper 32 bits of duration (use 32-bit only)
    (if (local.get $ver) (then
      (call $wb32 (i32.add (local.get $durOff) (i32.const 4)) (i32.const 0)))))

  ;; --- Core scan: find stts, collect sample count, patch both ---
  (func $scan (param $s i32) (param $e i32) (param $sampleCount i32) (result i32)
    (local $off i32) (local $sz i32) (local $ty i32) (local $inner i32) (local $next i32)
    (local $foundStts i32) (local $foundMdhd i32)
    (local.set $off (local.get $s))
    (local.set $foundStts (i32.const 0))
    (local.set $foundMdhd (i32.const 0))
    (block $done
      (loop $lp
        (br_if $done (i32.ge_u (local.get $off) (local.get $e)))
        (br_if $done (i32.gt_u (i32.add (local.get $off) (i32.const 8)) (local.get $e)))
        (local.set $sz (call $rb32 (local.get $off)))
        (local.set $ty (call $rb32 (i32.add (local.get $off) (i32.const 4))))
        (br_if $done (i32.eqz (local.get $sz)))
        (local.set $next (i32.add (local.get $off) (local.get $sz)))
        (br_if $done (i32.gt_u (local.get $next) (local.get $e)))
        ;; Handle 64-bit box size
        (if (i32.eq (local.get $sz) (i32.const 1))
          (then (local.set $inner (i32.add (local.get $off) (i32.const 16)))
                (local.set $sz (call $rb32 (i32.add (local.get $off) (i32.const 12))))
                (local.set $next (i32.add (local.get $off) (local.get $sz)))
                (br_if $done (i32.gt_u (local.get $next) (local.get $e))))
          (else (local.set $inner (i32.add (local.get $off) (i32.const 8)))))
        (block $nxt
          ;; stts: patch it, return sample count
          (if (i32.eq (local.get $ty) (i32.const 0x73747473))
            (then (call $patchStts (local.get $inner))
                  (local.set $foundStts (i32.const 1))
                  ;; Read total sample count from patched stts (offset 8 from payload start)
                  (local.set $sampleCount (call $rb32 (i32.add (local.get $inner) (i32.const 8))))
                  (br $nxt)))
          ;; mdhd: store dataOff, patch after we know sampleCount
          (if (i32.eq (local.get $ty) (i32.const 0x6D646864))
            (then (local.set $foundMdhd (local.get $inner))
                  (br $nxt)))
          ;; Recurse into containers
          (if (i32.eq (local.get $ty) (i32.const 0x6D6F6F76)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x7472616B)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x6D646961)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x6D696E66)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x7374626C)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x75647461)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x6D6F6F66)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x74726166)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x65647473)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x64696E66)) (then
            (local.set $sampleCount (call $scan (local.get $inner) (local.get $next) (local.get $sampleCount)))
            (br $nxt))))
        (local.set $off (local.get $next))
        (br $lp)))
    ;; After scanning children, patch mdhd if found
    (if (local.get $foundMdhd)
      (then (call $patchMdhd (local.get $foundMdhd) (local.get $sampleCount))))
    (local.get $sampleCount))

  ;; --- Entry point ---
  (func (export "patch") (param $len i32) (result i32)
    (drop (call $scan (i32.const 0) (local.get $len) (i32.const 0)))
    (i32.const 1))
)
