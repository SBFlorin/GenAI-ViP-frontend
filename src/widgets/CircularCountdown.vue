<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

type Props = {
    size?: number
    stroke?: number
    color?: string
    backgroundColor?: string
    gapAngle?: number
    startAngleDeg?: number
    fontFamily?: string
    duration?: number
    autoStart?: boolean
    loop?: boolean
    showCenterText?: boolean
    unit?: string
    /** Arrow size in px (tip-to-tail width); used with userSpaceOnUse marker */
    arrowSize?: number
    /** Extra spacing (px) between arc end and the start of the arrow head */
    arrowGap?: number
    /** Place arrow at the start of the arc */
    showStartArrow?: boolean
    /** Place arrow at the end of the arc */
    showEndArrow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    size: 180,
    stroke: 16,
    color: '#254C8E',
    backgroundColor: '#e9eef6',
    gapAngle: 50,
    startAngleDeg: -185,
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    duration: 20,
    autoStart: true,
    loop: false,
    showCenterText: true,
    unit: 'sec',
    arrowSize: 6, // small by default
    arrowGap: 0, // tiny visual breathing room
    showStartArrow: false,
    showEndArrow: true,
})

const emit = defineEmits<{
    (e: 'tick', remainingMs: number): void
    (e: 'complete'): void
}>()

const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const r = computed(() => (props.size - props.stroke) / 2)

// Animation state
const durationMs = ref(props.duration * 1000)
const remainingMs = ref(durationMs.value)
const isRunning = ref(false)
let rafId: number | null = null
let startTime = 0

const progress = computed(() => {
    if (remainingMs.value <= 0) return 0;
    return Math.max(0, Math.min(1, remainingMs.value / durationMs.value));
})
const remainingSeconds = computed(() => Math.ceil(remainingMs.value / 1000))

const displayNumber = computed(() => remainingSeconds.value)
const unit = computed(() => props.unit)

// Helper
const polarToXY = (angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180
    return { x: cx.value + r.value * Math.cos(a), y: cy.value + r.value * Math.sin(a) }
}

// Compute angular inset (degrees) so the arrow does not overlap the arc.
// We shorten the arc by an angle equal to (arrowSize + arrowGap) along the circle perimeter.
const arrowInsetDeg = computed(() => {
    const arcLenPx = Math.max(0, props.arrowSize + props.arrowGap)
    const rad = arcLenPx / r.value // radians
    return (rad * 180) / Math.PI // degrees
})

// Build the path with optional start/end insets
const arcPath = computed(() => {
    const full = 360 - props.gapAngle;
    const start = props.startAngleDeg;

    const startInset = props.showStartArrow ? arrowInsetDeg.value : 0;
    const endInset = props.showEndArrow ? arrowInsetDeg.value : 0;

    // Effective end based on progress
    const startEff = start + startInset;
    const minDelta = 0.001;
    const endEff = progress.value === 0
        ? startEff + minDelta
        : start + full * progress.value - endInset;

    const endSafe = endEff <= startEff ? startEff + minDelta : endEff;

    const p0 = polarToXY(startEff);
    const p1 = polarToXY(endSafe);

    const sweep = 1;
    const delta = Math.abs(endSafe - startEff);
    const largeArc = delta > 180 ? 1 : 0;

    return `M ${p0.x} ${p0.y} A ${r.value} ${r.value} 0 ${largeArc} ${sweep} ${p1.x} ${p1.y}`
})

// Arrow at a fixed position based on the full arc
const startArrowAngle = computed(() => props.startAngleDeg+30);
const endArrowAngle = computed(() => props.startAngleDeg + (360 - props.gapAngle));

const startArrowPos = computed(() => polarToXY(startArrowAngle.value));
const endArrowPos = computed(() => polarToXY(endArrowAngle.value));

const startArrowTransform = computed(() => `rotate(${startArrowAngle.value + 270}, ${startArrowPos.value.x}, ${startArrowPos.value.y})`);
const endArrowTransform = computed(() => `rotate(${endArrowAngle.value + 270}, ${endArrowPos.value.x}, ${endArrowPos.value.y})`);

// RAF loop
const frame = (now: number) => {
    if (!isRunning.value) return
    const elapsed = now - startTime
    const remaining = Math.max(0, durationMs.value - elapsed)
    remainingMs.value = remaining
    emit('tick', remaining)

    if (remaining <= 0) {
        emit('complete')
        if (props.loop) {
            reset()
            start()
        } else {
            stop()
        }
        return
    }
    rafId = requestAnimationFrame(frame)
}

const start = () => {
    if (isRunning.value) return
    isRunning.value = true
    startTime = performance.now() - (durationMs.value - remainingMs.value)
    rafId = requestAnimationFrame(frame)
}

const pause = () => {
    if (!isRunning.value) return
    isRunning.value = false
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
}

const stop = () => {
    isRunning.value = false
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
}

const reset = (newDurationSec?: number) => {
    if (typeof newDurationSec === 'number' && newDurationSec > 0) {
        durationMs.value = newDurationSec * 1000
    }
    remainingMs.value = durationMs.value
    startTime = performance.now()
}

watch(() => props.duration, (d) => {
    durationMs.value = Math.max(0.1, d) * 1000
    reset()
    if (props.autoStart) start()
})

onMounted(() => {
    reset()
    if (props.autoStart) start()
})

onBeforeUnmount(() => { stop() })

defineExpose({ start, pause, reset, stop, isRunning, remainingMs, remainingSeconds, progress })
</script>

<template>
    <div :style="{ width: size + 'px', height: size + 'px' }" class="c-wrap">
        <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size" role="img" aria-label="Circular countdown">
            <!-- Background ring -->
            <circle :cx="cx" :cy="cy" :r="r" :stroke="backgroundColor" :stroke-width="stroke" fill="none" />


            <!-- Animated arc. Remove marker-end -->
            <path :d="arcPath" fill="none" :stroke="color" :stroke-width="stroke" stroke-linecap="butt" />
            <!-- Arrow at start position -->
            <polygon
                v-if="showStartArrow && progress > 0"
                :points="`${startArrowPos.x},${startArrowPos.y - arrowSize / 2} ${startArrowPos.x + arrowSize},${startArrowPos.y} ${startArrowPos.x},${startArrowPos.y + arrowSize / 2}`"
                :fill="color"
                :transform="startArrowTransform"
            />
            <!-- Arrow at end position -->
            <polygon
                v-if="showEndArrow && progress > 0"
                :points="`${endArrowPos.x},${endArrowPos.y - arrowSize / 2} ${endArrowPos.x + arrowSize},${endArrowPos.y} ${endArrowPos.x},${endArrowPos.y + arrowSize / 2}`"
                :fill="color"
                :transform="endArrowTransform"
            />


            <!-- Default centered text -->
            <g v-if="showCenterText">
                <text :x="cx" :y="cy" text-anchor="middle" dominant-baseline="middle" :fill="color"
                    :font-family="fontFamily" :font-size="Math.round(size * 0.18)" font-weight="600">
                    <tspan :x="cx" :dy="-Math.round(size * 0.04)">{{ displayNumber }}</tspan>
                    <tspan :x="cx" :dy="Math.round(size * 0.18)" :font-size="Math.round(size * 0.12)" font-weight="500">
                        {{ unit }}</tspan>
                </text>
            </g>


            <!-- Slot for custom center content -->
            <foreignObject :x="size * 0.15" :y="size * 0.15" :width="size * 0.7" :height="size * 0.7">
                <div xmlns="http://www.w3.org/1999/xhtml" class="center-slot">
                    <slot :remaining-ms="remainingMs" :remaining-seconds="remainingSeconds" :progress="progress"></slot>
                </div>
            </foreignObject>
        </svg>
    </div>
</template>

<style scoped>
.c-wrap {
    display: inline-block;
    line-height: 0;
    position: relative;
}

.center-slot {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>