(module
  (memory (export "memory") 1)

  (func $readBE32 (param $addr i32) (result i32)
    (i32.or
      (i32.shl (i32.load8_u (local.get $addr)) (i32.const 24))
      (i32.or
        (i32.shl (i32.load8_u (i32.add (local.get $addr) (i32.const 1))) (i32.const 16))
        (i32.or
          (i32.shl (i32.load8_u (i32.add (local.get $addr) (i32.const 2))) (i32.const 8))
          (i32.load8_u (i32.add (local.get $addr) (i32.const 3)))))))

  (func $writeBE32 (param $addr i32) (param $val i32)
    (i32.store8 (local.get $addr) (i32.shr_u (local.get $val) (i32.const 24)))
    (i32.store8 (i32.add (local.get $addr) (i32.const 1)) (i32.shr_u (local.get $val) (i32.const 16)))
    (i32.store8 (i32.add (local.get $addr) (i32.const 2)) (i32.shr_u (local.get $val) (i32.const 8)))
    (i32.store8 (i32.add (local.get $addr) (i32.const 3)) (local.get $val)))

  (func $patchStts (param $dataOff i32)
    (i32.store8 (local.get $dataOff) (i32.const 0))
    (i32.store8 (i32.add (local.get $dataOff) (i32.const 1)) (i32.const 0))
    (i32.store8 (i32.add (local.get $dataOff) (i32.const 2)) (i32.const 0))
    (i32.store8 (i32.add (local.get $dataOff) (i32.const 3)) (i32.const 0))
    (call $writeBE32 (i32.add (local.get $dataOff) (i32.const 4)) (i32.const 1))
    (call $writeBE32 (i32.add (local.get $dataOff) (i32.const 8)) (i32.const 1)))

  (func $patchMdhd (param $dataOff i32)
    (local $ver i32) (local $tsOff i32) (local $durOff i32)
    (local $origTS i32) (local $origDur i32) (local $newDur i32)

    (local.set $ver (i32.load8_u (local.get $dataOff)))
    (if (i32.eqz (local.get $ver))
      (then
        (local.set $tsOff (i32.add (local.get $dataOff) (i32.const 12)))
        (local.set $durOff (i32.add (local.get $dataOff) (i32.const 16))))
      (else
        (local.set $tsOff (i32.add (local.get $dataOff) (i32.const 20)))
        (local.set $durOff (i32.add (local.get $dataOff) (i32.const 24)))))

    (local.set $origTS (call $readBE32 (local.get $tsOff)))
    (local.set $origDur (call $readBE32 (local.get $durOff)))
    (local.set $newDur
      (i32.div_u (i32.mul (local.get $origDur) (i32.const 60000)) (local.get $origTS)))
    (call $writeBE32 (local.get $tsOff) (i32.const 60000))
    (call $writeBE32 (local.get $durOff) (local.get $newDur)))

  ;; Recursively scan boxes from $start (inclusive) to $end (exclusive)
  (func $scanBoxes (param $start i32) (param $end i32)
    (local $off i32) (local $size i32) (local $type i32) (local $inner i32) (local $next i32)

    (local.set $off (local.get $start))
    (block $done
      (loop $loop
        (i32.ge_u (local.get $off) (local.get $end)) (br_if $done)
        (i32.gt_u (i32.add (local.get $off) (i32.const 8)) (local.get $end)) (br_if $done)

        (local.set $size (call $readBE32 (local.get $off)))
        (local.set $type (call $readBE32 (i32.add (local.get $off) (i32.const 4))))
        (i32.eqz (local.get $size)) (br_if $done)

        ;; Validate: off+size must not exceed end
        (local.set $next (i32.add (local.get $off) (local.get $size)))
        (i32.gt_u (local.get $next) (local.get $end)) (br_if $done)

        ;; Handle 64-bit size (size == 1)
        (if (i32.eq (local.get $size) (i32.const 1))
          (then
            (local.set $inner (i32.add (local.get $off) (i32.const 16)))
            (local.set $size (call $readBE32 (i32.add (local.get $off) (i32.const 12))))
            (local.set $next (i32.add (local.get $off) (local.get $size)))
            (i32.gt_u (local.get $next) (local.get $end)) (br_if $done))
          (else
            (local.set $inner (i32.add (local.get $off) (i32.const 8)))))

        ;; Dispatch on type
        (block $next
          ;; 'stts' = 0x73747473
          (if (i32.eq (local.get $type) (i32.const 0x73747473))
            (then (call $patchStts (local.get $inner)) (br $next)))
          ;; 'mdhd' = 0x6D646864
          (if (i32.eq (local.get $type) (i32.const 0x6D646864))
            (then (call $patchMdhd (local.get $inner)) (br $next)))
          ;; Container boxes – recurse into children
          (if (i32.eq (local.get $type) (i32.const 0x6D6F6F76))   ;; 'moov'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x7472616B))   ;; 'trak'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x6D646961))   ;; 'mdia'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x6D696E66))   ;; 'minf'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x7374626C))   ;; 'stbl'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x75647461))   ;; 'udta'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x6D6F6F66))   ;; 'moof'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x74726166))   ;; 'traf'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x65647473))   ;; 'edts'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
          (if (i32.eq (local.get $type) (i32.const 0x64696E66))   ;; 'dinf'
            (then (call $scanBoxes (local.get $inner) (local.get $next)) (br $next)))
        )

        (local.set $off (local.get $next))
        (br $loop))))

  (func (export "patch") (param $len i32) (result i32)
    (call $scanBoxes (i32.const 0) (local.get $len))
    (i32.const 1))
)
