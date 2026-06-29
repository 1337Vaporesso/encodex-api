(module
  ;; Memory: one page (64KB) for input, scratch, output
  (memory (export "mem") 10)
  
  ;; Data ranges (non-overlapping):
  ;; 16384 - 32767:  data arrays (sizes, offsets, etc.) set by JS glue
  ;; 65536 - 98303:  scratch area for payload building
  ;; 98304 - ~:      output area for box builders
  (global $dataOffset i32 (i32.const 16384))
  (global $inputOffset i32 (i32.const 4096))
  (global $inputLen (mut i32) (i32.const 0))
  (global $outputOffset i32 (i32.const 98304))
  (global $outputLen (mut i32) (i32.const 0))
  (global $scratchOffset i32 (i32.const 65536))
  (global $fakeBytesPtr i32 (i32.const 32768))
  
  ;; FAKE_SAMPLE_COUNT = 8573
  (func (export "getFakeSampleCount") (result i32)
    i32.const 8573
  )
  
  ;; FAKE_SAMPLE_SIZE = 8
  (func (export "getFakeSampleSize") (result i32)
    i32.const 8
  )
  
  ;; VIDEO_SAMPLE_DELTA = 1500
  (func (export "getVideoSampleDelta") (result i32)
    i32.const 1500
  )
  
  ;; FAKE_SAMPLE_BYTES = 8 bytes: 0,0,0,4, 0,0,0,0
  (func (export "getFakeSampleBytesPtr") (result i32)
    global.get $fakeBytesPtr
  )
  
  ;; Initialize the FAKE_SAMPLE_BYTES at memory location
  (func (export "init")
    global.get $fakeBytesPtr
    i32.const 0
    i32.store8 offset=0
    global.get $fakeBytesPtr
    i32.const 0
    i32.store8 offset=1
    global.get $fakeBytesPtr
    i32.const 0
    i32.store8 offset=2
    global.get $fakeBytesPtr
    i32.const 4
    i32.store8 offset=3
    global.get $fakeBytesPtr
    i32.const 0
    i32.store8 offset=4
    global.get $fakeBytesPtr
    i32.const 0
    i32.store8 offset=5
    global.get $fakeBytesPtr
    i32.const 0
    i32.store8 offset=6
    global.get $fakeBytesPtr
    i32.const 0
    i32.store8 offset=7
  )
  
  ;; Read a big-endian u32 from memory at offset
  (func $readU32 (param $ptr i32) (result i32)
    local.get $ptr
    i32.load8_u
    i32.const 24
    i32.shl
    local.get $ptr
    i32.const 1
    i32.add
    i32.load8_u
    i32.const 16
    i32.shl
    i32.or
    local.get $ptr
    i32.const 2
    i32.add
    i32.load8_u
    i32.const 8
    i32.shl
    i32.or
    local.get $ptr
    i32.const 3
    i32.add
    i32.load8_u
    i32.or
    return
  )
  
  ;; Write a big-endian u32 to memory at offset
  (func $writeU32 (param $ptr i32) (param $val i32)
    local.get $ptr
    local.get $val
    i32.const 24
    i32.shr_u
    i32.const 255
    i32.and
    i32.store8
    local.get $ptr
    i32.const 1
    i32.add
    local.get $val
    i32.const 16
    i32.shr_u
    i32.const 255
    i32.and
    i32.store8
    local.get $ptr
    i32.const 2
    i32.add
    local.get $val
    i32.const 8
    i32.shr_u
    i32.const 255
    i32.and
    i32.store8
    local.get $ptr
    i32.const 3
    i32.add
    local.get $val
    i32.const 255
    i32.and
    i32.store8
  )
  
  ;; Copy bytes from src to dst (len bytes)
  (func $memcpy (param $dst i32) (param $src i32) (param $len i32)
    (local $i i32)
    local.get $dst
    local.set $i
    (block $done
      (loop $copy
        local.get $i
        local.get $src
        i32.load8_u
        i32.store8
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        local.get $src
        i32.const 1
        i32.add
        local.set $src
        local.get $len
        i32.const 1
        i32.sub
        local.tee $len
        i32.const 0
        i32.ne
        br_if $copy
      )
    )
  )
  
  ;; Copy the input to the processing buffer and set inputLen
  (func (export "setInput") (param $bufPtr i32) (param $bufLen i32)
    local.get $bufLen
    global.set $inputLen
    global.get $inputOffset
    local.get $bufPtr
    local.get $bufLen
    call $memcpy
  )
  
  ;; Get output pointer
  (func (export "getOutputPtr") (result i32)
    global.get $outputOffset
  )
  
  ;; Get output length
  (func (export "getOutputLen") (result i32)
    global.get $outputLen
  )
  
  ;; Make a box with header 8 bytes + payload
  ;; $ptr: output buffer pointer (updated)
  ;; $type: 4-byte type as i32 (e.g., "stts" = 0x73747473)
  ;; $payloadPtr: payload data pointer
  ;; $payloadLen: payload length
  (func $makeBox (param $ptr i32) (param $type i32) (param $payloadPtr i32) (param $payloadLen i32) (result i32)
    (local $total i32)
    local.get $payloadLen
    i32.const 8
    i32.add
    local.set $total
    ;; write size (big-endian)
    local.get $ptr
    local.get $total
    call $writeU32
    ;; write type
    local.get $ptr
    i32.const 4
    i32.add
    local.get $type
    call $writeU32
    ;; copy payload
    local.get $ptr
    i32.const 8
    i32.add
    local.get $payloadPtr
    local.get $payloadLen
    call $memcpy
    ;; return new pointer
    local.get $ptr
    local.get $total
    i32.add
  )
  
  ;; Build stts box
  ;; $ptr: where to write
  ;; $sampleCount: number of real samples
  ;; $sampleDelta: sample delta (e.g., 1500)
  ;; Returns: new ptr after box
  (func (export "buildStts") (param $ptr i32) (param $sampleCount i32) (param $sampleDelta i32) (result i32)
    (local $payloadPtr i32) (local $payloadLen i32)
    ;; payload = 24 bytes: version(1)+flags(3)=4, entry_count=2(4), 
    ;;                    count=sampleCount(4), delta=sampleDelta(4),
    ;;                    count=8573(4), delta=sampleDelta(4)
    global.get $scratchOffset
    local.set $payloadPtr
    i32.const 24
    local.set $payloadLen
    
    ;; version+flags: 0x00000000
    local.get $payloadPtr
    i32.const 0
    call $writeU32
    ;; entry_count = 2
    local.get $payloadPtr
    i32.const 4
    i32.add
    i32.const 2
    call $writeU32
    ;; entry 0: count = sampleCount
    local.get $payloadPtr
    i32.const 8
    i32.add
    local.get $sampleCount
    call $writeU32
    ;; entry 0: delta = sampleDelta
    local.get $payloadPtr
    i32.const 12
    i32.add
    local.get $sampleDelta
    call $writeU32
    ;; entry 1: count = 8573
    local.get $payloadPtr
    i32.const 16
    i32.add
    i32.const 8573
    call $writeU32
    ;; entry 1: delta = sampleDelta
    local.get $payloadPtr
    i32.const 20
    i32.add
    local.get $sampleDelta
    call $writeU32
    
    local.get $ptr
    i32.const 0x73747473  ;; "stts"
    local.get $payloadPtr
    local.get $payloadLen
    call $makeBox
  )
  
  ;; Build stsz box
  ;; $ptr: where to write
  ;; $sizesPtr: pointer to array of real sample sizes (each 4 bytes big-endian)
  ;; $sizesLen: number of real samples
  ;; Returns: new ptr after box
  (func (export "buildStsz") (param $ptr i32) (param $sizesPtr i32) (param $sizesLen i32) (result i32)
    (local $totalCount i32) (local $payloadPtr i32) (local $payloadLen i32) (local $i i32) (local $wp i32)
    ;; totalCount = sizesLen + 8573
    local.get $sizesLen
    i32.const 8573
    i32.add
    local.set $totalCount
    
    ;; payload = version+flags(4) + sample_size=0(4) + sample_count(4) + sizes(totalCount * 4)
    i32.const 12
    local.get $totalCount
    i32.const 2
    i32.shl
    i32.add
    local.set $payloadLen
    
    global.get $scratchOffset
    local.set $payloadPtr
    
    ;; version+flags = 0
    local.get $payloadPtr
    i32.const 0
    call $writeU32
    ;; sample_size = 0 (variable)
    local.get $payloadPtr
    i32.const 4
    i32.add
    i32.const 0
    call $writeU32
    ;; sample_count = totalCount
    local.get $payloadPtr
    i32.const 8
    i32.add
    local.get $totalCount
    call $writeU32
    
    ;; copy real sizes
    local.get $payloadPtr
    i32.const 12
    i32.add
    local.get $sizesPtr
    local.get $sizesLen
    i32.const 2
    i32.shl
    call $memcpy
    
    ;; fill fake sizes (FAKE_SAMPLE_SIZE = 8)
    local.get $payloadPtr
    i32.const 12
    i32.add
    local.get $sizesLen
    i32.const 2
    i32.shl
    i32.add
    local.set $wp
    i32.const 0
    local.set $i
    (block $done
      (loop $loop
        local.get $wp
        i32.const 8
        call $writeU32
        local.get $wp
        i32.const 4
        i32.add
        local.set $wp
        local.get $i
        i32.const 1
        i32.add
        local.tee $i
        i32.const 8573
        i32.lt_u
        br_if $loop
      )
    )
    
    local.get $ptr
    i32.const 0x7374737A  ;; "stsz"
    local.get $payloadPtr
    local.get $payloadLen
    call $makeBox
  )
  
  ;; Build stsc box
  ;; $ptr: where to write
  ;; $entriesPtr: array of entries (each 12 bytes: first_chunk u32, samples_per_chunk u32, sample_desc u32)
  ;; $entriesLen: number of original entries
  ;; $chunkCount: number of original chunks (= stco entries count)
  ;; Returns: new ptr after box
  (func (export "buildStsc") (param $ptr i32) (param $entriesPtr i32) (param $entriesLen i32) (param $chunkCount i32) (result i32)
    (local $newCount i32) (local $payloadPtr i32) (local $payloadLen i32) (local $wp i32) (local $lastSamplesPerChunk i32) (local $i i32)
    
    ;; Check last entry's samples_per_chunk
    local.get $entriesLen
    i32.const 1
    i32.sub
    local.set $i
    local.get $entriesPtr
    local.get $i
    i32.const 12
    i32.mul
    i32.add
    i32.const 4
    i32.add
    call $readU32
    local.set $lastSamplesPerChunk
    
    ;; newCount = entriesLen (+1 if last samples_per_chunk != 1)
    local.get $entriesLen
    local.set $newCount
    (if (i32.ne (local.get $lastSamplesPerChunk) (i32.const 1))
      (then
        local.get $newCount
        i32.const 1
        i32.add
        local.set $newCount
      )
    )
    
    ;; payload = version+flags(4) + entry_count(4) + entries(newCount * 12)
    i32.const 8
    local.get $newCount
    i32.const 12
    i32.mul
    i32.add
    local.set $payloadLen
    
    global.get $scratchOffset
    local.set $payloadPtr
    local.get $payloadPtr
    local.set $wp
    
    ;; version+flags = 0
    local.get $wp
    i32.const 0
    call $writeU32
    local.get $wp
    i32.const 4
    i32.add
    local.set $wp
    ;; entry_count
    local.get $wp
    local.get $newCount
    call $writeU32
    local.get $wp
    i32.const 4
    i32.add
    local.set $wp
    
    ;; copy original entries
    local.get $wp
    local.get $entriesPtr
    local.get $entriesLen
    i32.const 12
    i32.mul
    call $memcpy
    local.get $wp
    local.get $entriesLen
    i32.const 12
    i32.mul
    i32.add
    local.set $wp
    
    ;; add fake entry if needed: (chunkCount+1, 1, 1)
    (if (i32.ne (local.get $lastSamplesPerChunk) (i32.const 1))
      (then
        local.get $wp
        local.get $chunkCount
        i32.const 1
        i32.add
        call $writeU32
        local.get $wp
        i32.const 4
        i32.add
        i32.const 1
        call $writeU32
        local.get $wp
        i32.const 8
        i32.add
        i32.const 1
        call $writeU32
      )
    )
    
    local.get $ptr
    i32.const 0x73747363  ;; "stsc"
    local.get $payloadPtr
    local.get $payloadLen
    call $makeBox
  )
  
  ;; Build stco box
  ;; $ptr: where to write
  ;; $offsetsPtr: array of original chunk offsets (each 4 bytes big-endian)
  ;; $offsetsLen: number of chunks
  ;; $delta: offset adjustment
  ;; $hasFake: 1 if should add fake entries, 0 otherwise
  ;; Returns: new ptr after box
  (func (export "buildStco") (param $ptr i32) (param $offsetsPtr i32) (param $offsetsLen i32) (param $delta i32) (param $hasFake i32) (result i32)
    (local $totalCount i32) (local $payloadPtr i32) (local $payloadLen i32) (local $wp i32) (local $i i32) (local $val i32)
    
    ;; total = offsetsLen + (hasFake ? 8573 : 0)
    local.get $offsetsLen
    local.set $totalCount
    (if (i32.eqz (local.get $hasFake))
      (then)
      (else
        local.get $totalCount
        i32.const 8573
        i32.add
        local.set $totalCount
      )
    )
    
    ;; payload = version+flags(4) + entry_count(4) + offsets(totalCount * 4)
    i32.const 8
    local.get $totalCount
    i32.const 2
    i32.shl
    i32.add
    local.set $payloadLen
    
    global.get $scratchOffset
    local.set $payloadPtr
    local.get $payloadPtr
    local.set $wp
    
    ;; version+flags = 0
    local.get $wp
    i32.const 0
    call $writeU32
    local.get $wp
    i32.const 4
    i32.add
    local.set $wp
    
    ;; entry_count = totalCount
    local.get $wp
    local.get $totalCount
    call $writeU32
    local.get $wp
    i32.const 4
    i32.add
    local.set $wp
    
    ;; copy adjusted offsets
    i32.const 0
    local.set $i
    (block $done
      (loop $loop
        ;; check bounds
        local.get $i
        local.get $offsetsLen
        i32.ge_u
        br_if $done
        
        ;; read original offset, add delta
        local.get $offsetsPtr
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        call $readU32
        local.get $delta
        i32.add
        local.set $val
        
        ;; write adjusted offset at wp
        local.get $wp
        local.get $val
        call $writeU32
        local.get $wp
        i32.const 4
        i32.add
        local.set $wp
        
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      )
    )
    
    ;; add fake offsets if needed (point to the fake sample at the end of mdat)
    (if (i32.eqz (local.get $hasFake))
      (then)
      (else
        i32.const 0
        local.set $i
        (loop $fakeLoop
          ;; calculate fake offset: start of fake data after original mdat
          ;; For simplicity, write 0 as placeholder - will be adjusted by JS
          local.get $wp
          i32.const 0
          call $writeU32
          local.get $wp
          i32.const 4
          i32.add
          local.set $wp
          local.get $i
          i32.const 1
          i32.add
          local.tee $i
          i32.const 8573
          i32.lt_u
          br_if $fakeLoop
        )
      )
    )
    
    local.get $ptr
    i32.const 0x7374636F  ;; "stco"
    local.get $payloadPtr
    local.get $payloadLen
    call $makeBox
  )
  
  ;; Build mdhd box (preserve original payload)
  ;; $ptr: where to write
  ;; $payloadPtr: original mdhd payload bytes
  ;; $payloadLen: mdhd payload length
  ;; Returns: new ptr after box
  (func (export "buildMdhd") (param $ptr i32) (param $payloadPtr i32) (param $payloadLen i32) (result i32)
    local.get $ptr
    i32.const 0x6D646864  ;; "mdhd"
    local.get $payloadPtr
    local.get $payloadLen
    call $makeBox
  )
  
  ;; Build elst box (preserve original payload)
  (func (export "buildElst") (param $ptr i32) (param $payloadPtr i32) (param $payloadLen i32) (result i32)
    local.get $ptr
    i32.const 0x656C7374  ;; "elst"
    local.get $payloadPtr
    local.get $payloadLen
    call $makeBox
  )
  
  ;; Read stco offsets from an stco box
  ;; $inputDataPtr: pointer to input data
  ;; $stcoOffset: offset of stco box start
  ;; $stcoSize: total stco box size
  ;; $outPtr: pointer to output array (pre-allocated)
  ;; Returns: number of offsets
  (func (export "parseStco") (param $inputDataPtr i32) (param $stcoOffset i32) (param $stcoSize i32) (param $outPtr i32) (result i32)
    (local $entryCount i32) (local $dataStart i32) (local $i i32)
    ;; entry_count is at stcoOffset + 12 (after 8-byte header + version(4))
    local.get $inputDataPtr
    local.get $stcoOffset
    i32.add
    i32.const 12
    i32.add
    call $readU32
    local.set $entryCount
    
    ;; data starts at stcoOffset + 16
    local.get $stcoOffset
    i32.const 16
    i32.add
    local.set $dataStart
    
    i32.const 0
    local.set $i
    (block $done
      (loop $loop
        local.get $i
        local.get $entryCount
        i32.ge_u
        br_if $done
        
        local.get $outPtr
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        local.get $inputDataPtr
        local.get $dataStart
        i32.add
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        call $readU32
        call $writeU32
        
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      )
    )
    
    local.get $entryCount
  )
  
  ;; Read stsz sample sizes from an stsz box
  ;; $inputDataPtr: pointer to input data
  ;; $stszOffset: offset of stsz box start
  ;; $outPtr: pointer to output array
  ;; Returns: number of samples
  (func (export "parseStsz") (param $inputDataPtr i32) (param $stszOffset i32) (param $outPtr i32) (result i32)
    (local $sampleSize i32) (local $sampleCount i32) (local $dataStart i32) (local $i i32)
    
    ;; sample_size at stszOffset + 12
    local.get $inputDataPtr
    local.get $stszOffset
    i32.add
    i32.const 12
    i32.add
    call $readU32
    local.set $sampleSize
    
    ;; sample_count at stszOffset + 16
    local.get $inputDataPtr
    local.get $stszOffset
    i32.add
    i32.const 16
    i32.add
    call $readU32
    local.set $sampleCount
    
    (if (i32.eqz (local.get $sampleSize))
      (then
        ;; variable sizes - start at stszOffset + 20
        local.get $stszOffset
        i32.const 20
        i32.add
        local.set $dataStart
        
        i32.const 0
        local.set $i
        (block $done
          (loop $loop
            local.get $i
            local.get $sampleCount
            i32.ge_u
            br_if $done
            
            local.get $outPtr
            local.get $i
            i32.const 2
            i32.shl
            i32.add
            local.get $inputDataPtr
            local.get $dataStart
            i32.add
            local.get $i
            i32.const 2
            i32.shl
            i32.add
            call $readU32
            call $writeU32
            
            local.get $i
            i32.const 1
            i32.add
            local.set $i
            br $loop
          )
        )
      )
      (else
        ;; constant size - fill array with sampleSize
        i32.const 0
        local.set $i
        (block $done2
          (loop $loop2
            local.get $i
            local.get $sampleCount
            i32.ge_u
            br_if $done2
            
            local.get $outPtr
            local.get $i
            i32.const 2
            i32.shl
            i32.add
            local.get $sampleSize
            call $writeU32
            
            local.get $i
            i32.const 1
            i32.add
            local.set $i
            br $loop2
          )
        )
      )
    )
    
    local.get $sampleCount
  )
  
  ;; Read stsc entries from an stsc box
  ;; $inputDataPtr: pointer to input data
  ;; $stscOffset: offset of stsc box start
  ;; $outPtr: pointer to output array (each entry = 3 u32s = 12 bytes)
  ;; Returns: number of entries
  (func (export "parseStsc") (param $inputDataPtr i32) (param $stscOffset i32) (param $outPtr i32) (result i32)
    (local $entryCount i32) (local $dataStart i32) (local $i i32)
    
    ;; entry_count at stscOffset + 12
    local.get $inputDataPtr
    local.get $stscOffset
    i32.add
    i32.const 12
    i32.add
    call $readU32
    local.set $entryCount
    
    ;; data starts at stscOffset + 16
    local.get $stscOffset
    i32.const 16
    i32.add
    local.set $dataStart
    
    i32.const 0
    local.set $i
    (block $done
      (loop $loop
        local.get $i
        local.get $entryCount
        i32.ge_u
        br_if $done
        
        ;; copy 12 bytes per entry
        local.get $outPtr
        local.get $i
        i32.const 12
        i32.mul
        i32.add
        local.get $inputDataPtr
        local.get $dataStart
        i32.add
        local.get $i
        i32.const 12
        i32.mul
        i32.add
        i32.const 12
        call $memcpy
        
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      )
    )
    
    local.get $entryCount
  )
  
  ;; Read mdhd payload (for buildMdhd)
  ;; $inputDataPtr: pointer to input data
  ;; $mdhdOffset: offset of mdhd box start
  ;; $mdhdSize: mdhd box size
  ;; $outPtr: where to write the payload
  ;; Returns: payload length
  (func (export "getMdhdPayload") (param $inputDataPtr i32) (param $mdhdOffset i32) (param $mdhdSize i32) (param $outPtr i32) (result i32)
    (local $payloadLen i32)
    ;; payload = mdhdSize - 8
    local.get $mdhdSize
    i32.const 8
    i32.sub
    local.set $payloadLen
    
    local.get $outPtr
    local.get $inputDataPtr
    local.get $mdhdOffset
    i32.add
    i32.const 8
    i32.add  ;; skip 8-byte header
    local.get $payloadLen
    call $memcpy
    
    local.get $payloadLen
  )
  
  ;; Same for elst
  (func (export "getElstPayload") (param $inputDataPtr i32) (param $elstOffset i32) (param $elstSize i32) (param $outPtr i32) (result i32)
    (local $payloadLen i32)
    local.get $elstSize
    i32.const 8
    i32.sub
    local.set $payloadLen
    
    local.get $outPtr
    local.get $inputDataPtr
    local.get $elstOffset
    i32.add
    i32.const 8
    i32.add
    local.get $payloadLen
    call $memcpy
    
    local.get $payloadLen
  )
  
  ;; Copy input data bytes (for boxBytes and boxPayload operations)
  ;; $inputDataPtr: pointer to input data
  ;; $srcOffset: offset within input
  ;; $len: number of bytes to copy
  ;; $dst: destination in memory
  (func (export "getBytes") (param $inputDataPtr i32) (param $srcOffset i32) (param $len i32) (param $dst i32)
    local.get $dst
    local.get $inputDataPtr
    local.get $srcOffset
    i32.add
    local.get $len
    call $memcpy
  )
  
  ;; Write output to the output buffer (simple concat of byte arrays)
  ;; $ptr: current output position
  ;; $data: pointer to data
  ;; $len: data length
  ;; Returns: new output position
  (func (export "writeOutput") (param $ptr i32) (param $data i32) (param $len i32) (result i32)
    local.get $ptr
    local.get $data
    local.get $len
    call $memcpy
    local.get $ptr
    local.get $len
    i32.add
  )
  
  ;; Set the final output length
  (func (export "setOutputLen") (param $len i32)
    local.get $len
    global.set $outputLen
  )
)
