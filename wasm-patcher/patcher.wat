(module
  (memory (export "memory") 1)

  ;; Storage layout (at end-of-memory minus 512 bytes):
  ;; base+0: sttsCount (i32)
  ;; base+4: mdhdCount (i32)
  ;; base+8: sttsArr[10] each 16 bytes = dataOff(4)+totalSamples(4)+totalDuration(8)
  ;; base+168: mdhdArr[10] each 20 bytes = dataOff(4)+version(4)+tsOff(4)+durOff(4)+pad(4)

  ;; Compute storage base = end of last page minus 512 bytes
  (func $sbase (result i32)
    (i32.sub (i32.shl (memory.size) (i32.const 16)) (i32.const 512)))

  ;; --- Helpers ---
  (func $rb32 (param $a i32) (result i32)
    (i32.or (i32.shl (i32.load8_u (local.get $a)) (i32.const 24))
    (i32.or (i32.shl (i32.load8_u (i32.add (local.get $a) (i32.const 1))) (i32.const 16))
    (i32.or (i32.shl (i32.load8_u (i32.add (local.get $a) (i32.const 2))) (i32.const 8))
    (i32.load8_u (i32.add (local.get $a) (i32.const 3)))))))

  (func $wb32 (param $a i32) (param $v i32)
    (i32.store8 (local.get $a) (i32.shr_u (local.get $v) (i32.const 24)))
    (i32.store8 (i32.add (local.get $a) (i32.const 1)) (i32.shr_u (local.get $v) (i32.const 16)))
    (i32.store8 (i32.add (local.get $a) (i32.const 2)) (i32.shr_u (local.get $v) (i32.const 8)))
    (i32.store8 (i32.add (local.get $a) (i32.const 3)) (local.get $v)))

  ;; --- saveStts: sum entries, store in arr ---
  (func $saveStts (param $dOff i32) (param $base i32)
    (local $i i32) (local $ec i32) (local $ea i32) (local $sc i32) (local $sd i32)
    (local $ts i32) (local $td i64) (local $idx i32) (local $ptr i32)

    (local.set $ec (call $rb32 (i32.add (local.get $dOff) (i32.const 4))))
    (if (i32.eqz (local.get $ec)) (then (return)))
    (if (i32.gt_u (local.get $ec) (i32.const 100000)) (then (return)))
    (if (i32.eq (local.get $ec) (i32.const 1)) (then (return)))

    (local.set $i (i32.const 0))
    (local.set $ts (i32.const 0))
    (local.set $td (i64.const 0))
    (block $done
      (loop $lp
        (br_if $done (i32.ge_u (local.get $i) (local.get $ec)))
        (local.set $ea (i32.add (i32.add (local.get $dOff) (i32.const 8))
          (i32.mul (local.get $i) (i32.const 8))))
        (local.set $sc (call $rb32 (local.get $ea)))
        (local.set $sd (call $rb32 (i32.add (local.get $ea) (i32.const 4))))
        (local.set $ts (i32.add (local.get $ts) (local.get $sc)))
        (local.set $td (i64.add (local.get $td)
          (i64.mul (i64.extend_i32_u (local.get $sc)) (i64.extend_i32_u (local.get $sd)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $lp)))

    (if (i32.eqz (local.get $ts)) (then (return)))
    (if (i32.gt_u (local.get $ts) (i32.const 1000000)) (then (return)))

    (local.set $idx (i32.load (local.get $base)))
    (if (i32.ge_u (local.get $idx) (i32.const 10)) (then (return)))
    (local.set $ptr (i32.add (i32.add (local.get $base) (i32.const 8)) (i32.mul (local.get $idx) (i32.const 16))))
    (i32.store (local.get $ptr) (local.get $dOff))
    (i32.store (i32.add (local.get $ptr) (i32.const 4)) (local.get $ts))
    (i64.store (i32.add (local.get $ptr) (i32.const 8)) (local.get $td))
    (i32.store (local.get $base) (i32.add (local.get $idx) (i32.const 1))))

  ;; --- saveMdhd: store info in arr ---
  (func $saveMdhd (param $dOff i32) (param $base i32)
    (local $ver i32) (local $idx i32) (local $tsOff i32) (local $durOff i32) (local $ptr i32)
    (local.set $ver (i32.load8_u (local.get $dOff)))
    (if (i32.eqz (local.get $ver))
      (then (local.set $tsOff (i32.add (local.get $dOff) (i32.const 12)))
            (local.set $durOff (i32.add (local.get $dOff) (i32.const 16))))
      (else (local.set $tsOff (i32.add (local.get $dOff) (i32.const 20)))
            (local.set $durOff (i32.add (local.get $dOff) (i32.const 24)))))
    (local.set $idx (i32.load (i32.add (local.get $base) (i32.const 4))))
    (if (i32.ge_u (local.get $idx) (i32.const 10)) (then (return)))
    (local.set $ptr (i32.add (i32.add (local.get $base) (i32.const 168)) (i32.mul (local.get $idx) (i32.const 20))))
    (i32.store (local.get $ptr) (local.get $dOff))
    (i32.store (i32.add (local.get $ptr) (i32.const 4)) (local.get $ver))
    (i32.store (i32.add (local.get $ptr) (i32.const 8)) (local.get $tsOff))
    (i32.store (i32.add (local.get $ptr) (i32.const 12)) (local.get $durOff))
    (i32.store (i32.add (local.get $base) (i32.const 4)) (i32.add (local.get $idx) (i32.const 1))))

  ;; --- applyPatches: write stts and mdhd using stored data ---
  (func $applyPatches (param $base i32)
    (local $i i32) (local $scnt i32) (local $mcnt i32)
    (local $sp i32) (local $mp i32) (local $dOff i32)
    (local $ts i32) (local $td i64) (local $ad i64) (local $nd i32)
    (local.set $scnt (i32.load (local.get $base)))
    (local.set $mcnt (i32.load (i32.add (local.get $base) (i32.const 4))))
    (local.set $i (i32.const 0))
    (block $done
      (loop $lp
        (br_if $done (i32.ge_u (local.get $i) (local.get $scnt)))
        (local.set $sp (i32.add (i32.add (local.get $base) (i32.const 8)) (i32.mul (local.get $i) (i32.const 16))))
        (local.set $ts (i32.load (i32.add (local.get $sp) (i32.const 4))))
        (if (i32.eqz (local.get $ts)) (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $lp)))
        (local.set $td (i64.load (i32.add (local.get $sp) (i32.const 8))))
        (local.set $ad (i64.div_u (local.get $td) (i64.extend_i32_u (local.get $ts))))
        (local.set $dOff (i32.load (local.get $sp)))
        ;; Write stts patch
        (call $wb32 (i32.add (local.get $dOff) (i32.const 4)) (i32.const 1))
        (call $wb32 (i32.add (local.get $dOff) (i32.const 8)) (local.get $ts))
        (call $wb32 (i32.add (local.get $dOff) (i32.const 12)) (i32.wrap_i64 (local.get $ad)))
        ;; Write paired mdhd if available
        (if (i32.lt_u (local.get $i) (local.get $mcnt))
          (then
            (local.set $mp (i32.add (i32.add (local.get $base) (i32.const 168)) (i32.mul (local.get $i) (i32.const 20))))
            (local.set $nd (i32.mul (local.get $ts) (i32.wrap_i64 (local.get $ad))))
            (call $wb32 (i32.load (i32.add (local.get $mp) (i32.const 12))) (local.get $nd))
            (if (i32.eq (i32.load (i32.add (local.get $mp) (i32.const 4))) (i32.const 1))
              (then (call $wb32 (i32.add (i32.load (i32.add (local.get $mp) (i32.const 12))) (i32.const 4)) (i32.const 0))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $lp))))

  ;; --- pass1: recursive scan, save stts & mdhd info ---
  (func $pass1 (param $s i32) (param $e i32) (param $base i32)
    (local $off i32) (local $sz i32) (local $ty i32) (local $inner i32) (local $next i32)
    (local.set $off (local.get $s))
    (block $done
      (loop $lp
        (br_if $done (i32.ge_u (local.get $off) (local.get $e)))
        (br_if $done (i32.gt_u (i32.add (local.get $off) (i32.const 8)) (local.get $e)))
        (local.set $sz (call $rb32 (local.get $off)))
        (local.set $ty (call $rb32 (i32.add (local.get $off) (i32.const 4))))
        (br_if $done (i32.eqz (local.get $sz)))
        (local.set $next (i32.add (local.get $off) (local.get $sz)))
        (br_if $done (i32.gt_u (local.get $next) (local.get $e)))
        (if (i32.eq (local.get $sz) (i32.const 1))
          (then (local.set $inner (i32.add (local.get $off) (i32.const 16)))
                (local.set $sz (call $rb32 (i32.add (local.get $off) (i32.const 12))))
                (local.set $next (i32.add (local.get $off) (local.get $sz)))
                (br_if $done (i32.gt_u (local.get $next) (local.get $e))))
          (else (local.set $inner (i32.add (local.get $off) (i32.const 8)))))
        (block $nxt
          (if (i32.eq (local.get $ty) (i32.const 0x73747473)) (then (call $saveStts (local.get $inner) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x6D646864)) (then (call $saveMdhd (local.get $inner) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x6D6F6F76)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x7472616B)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x6D646961)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x6D696E66)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x7374626C)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x75647461)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x6D6F6F66)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x74726166)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x65647473)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt)))
          (if (i32.eq (local.get $ty) (i32.const 0x64696E66)) (then (call $pass1 (local.get $inner) (local.get $next) (local.get $base)) (br $nxt))))
        (local.set $off (local.get $next))
        (br $lp))))

  ;; --- Entry point ---
  (func (export "patch") (param $len i32) (result i32)
    (local $base i32) (local $end i32)
    (local.set $end (i32.shl (memory.size) (i32.const 16)))
    ;; Ensure last page has at least 512 bytes free for storage
    (if (i32.ge_u (local.get $len) (i32.sub (local.get $end) (i32.const 512)))
      (then (drop (memory.grow (i32.const 1)))))
    (local.set $base (call $sbase))
    (i32.store (local.get $base) (i32.const 0))
    (i32.store (i32.add (local.get $base) (i32.const 4)) (i32.const 0))
    (call $pass1 (i32.const 0) (local.get $len) (local.get $base))
    (call $applyPatches (local.get $base))
    (i32.const 1))
)
