<template>
    <div v-if="show" class="config-dialog" :class="{ 'dark-mode': isDarkMode }" @click.stop>
        <div class="dialog-content">
            <div class="dialog-header">
                <h3>Presentation Timer Settings</h3>
                <div class="dialog-header-actions">
                    <button @click="showHelp = !showHelp" class="header-action-button">
                        {{ showHelp ? 'Hide help' : 'Help' }}
                    </button>
                    <button @click="exportConfigs" class="header-action-button">Export</button>
                    <button @click="showImport = !showImport" class="header-action-button">Import</button>
                </div>
            </div>

            <div v-if="showHelp" class="help-panel">
                <p><strong>Chips in the presenter nav bar:</strong></p>
                <ul>
                    <li><strong>Clock</strong>: wall-clock elapsed since this segment's start time</li>
                    <li><strong>Timer</strong>: countdown for the current slide (red over plan)</li>
                    <li><strong>Piggy bank</strong>: banked time for this segment</li>
                    <li><strong>Crystal ball</strong>: estimated end of this segment. Up arrow = running long, down arrow = running short. Red = late, blue = early, yellow = slightly off, green = on target.</li>
                    <li><strong>Bullseye</strong>: target completion time (when set)</li>
                    <li><strong>Pause</strong>: time until next scheduled break, with projected landing slide</li>
                    <li><strong>Break</strong>: take an on-demand break (pick a duration)</li>
                </ul>
                <p><strong>Segments</strong> come from <code>pacerBoundary: true</code> frontmatter on slides. The active segment is the one containing the slide you're on. Each segment has its own start, target, and breaks.</p>
                <p><strong>Breaks</strong> are wall-clock anchored. When due, the break chip pulses red; click to raise the overlay. The overlay shows on both presenter and audience views and pauses the slide timer.</p>
            </div>

            <div v-if="showImport" class="import-panel">
                <p class="help-text">Paste an exported settings JSON. This replaces start/target/breaks for every segment listed in the file.</p>
                <textarea v-model="importJson" class="import-textarea" rows="6"
                    placeholder='{"version": 1, "segments": [...]}'></textarea>
                <div v-if="importError" class="import-error">{{ importError }}</div>
                <div class="import-actions">
                    <button @click="applyImport" class="small-button apply-import">Apply import</button>
                    <button @click="showImport = false; importJson = ''; importError = ''" class="small-button">Cancel</button>
                </div>
            </div>

            <div v-for="seg in segmentConfigs" :key="seg.index" class="segment-section"
                :class="{ 'is-current': seg.index === currentSegment.index }">
                <div class="segment-header">
                    <span class="segment-title">{{ seg.label }}</span>
                    <span v-if="seg.index === currentSegment.index" class="segment-current-badge">current</span>
                    <span class="segment-pages">slides {{ seg.start + 1 }}&ndash;{{ seg.end + 1 }}</span>
                </div>

                <div class="segment-field">
                    <label>Start time</label>
                    <div class="field-row">
                        <button @click="setStartNow(seg)" class="small-button">Start now</button>
                        <span class="field-sep">or</span>
                        <input type="datetime-local" v-model="seg.startInput" />
                        <button v-if="seg.startInput" @click="seg.startInput = ''" class="small-button">Clear</button>
                    </div>
                </div>

                <div class="segment-field">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="seg.useTargetCompletion" />
                        <span>Target completion time</span>
                    </label>
                    <div v-if="seg.useTargetCompletion" class="field-row indented">
                        <input type="datetime-local" v-model="seg.targetInput" />
                    </div>
                </div>

                <div class="segment-field">
                    <label>Breaks</label>
                    <div v-if="seg.breaks.length === 0" class="no-breaks">No breaks scheduled.</div>
                    <div v-for="(brk, idx) in seg.breaks" :key="brk.id" class="break-row">
                        <input type="datetime-local" v-model="brk.startInput" class="break-start" />
                        <input type="number" min="1" step="1" v-model.number="brk.durationMinutes" class="break-duration" />
                        <span class="break-unit">min</span>
                        <span v-if="brk.dismissedAt" class="break-state past">past</span>
                        <span v-else-if="brk.raisedAt" class="break-state active">active</span>
                        <button @click="removeBreak(seg, idx)" class="break-remove" title="Delete this break">&times;</button>
                    </div>
                    <button @click="addBreak(seg)" class="small-button add-break-button">+ Add break</button>
                </div>
            </div>

            <div class="management-section">
                <h4>Slide timing data</h4>
                <div class="slide-time-management">
                    <button @click="clearSlideTimes" class="management-button danger-button">Clear all slide times</button>
                    <button @click="exportSlideTimes" class="management-button export-button">Export slide times</button>
                </div>
                <p class="help-text">Slide times are recorded during a presentation for calibration. Export the report to analyze, or clear all to start fresh.</p>
            </div>

            <div v-if="showConfirmDialog" class="confirmation-overlay" @click="cancelConfirmation">
                <div class="confirmation-dialog" @click.stop>
                    <h3>{{ confirmationTitle }}</h3>
                    <p>{{ confirmationMessage }}</p>
                    <div class="confirmation-buttons">
                        <button @click="cancelConfirmation" class="cancel-button">Cancel</button>
                        <button @click="confirmAction" class="confirm-button">{{ confirmationAction }}</button>
                    </div>
                </div>
            </div>

            <div v-if="showNotification" class="notification-overlay" @click="closeNotification">
                <div class="notification-dialog" @click.stop>
                    <h3>{{ notificationTitle }}</h3>
                    <p>{{ notificationMessage }}</p>
                    <div class="notification-buttons">
                        <button @click="closeNotification" class="notification-button">OK</button>
                    </div>
                </div>
            </div>

            <div class="dialog-buttons">
                <button @click="saveSettings" class="primary-button">Save all</button>
                <button @click="closeDialog">Cancel</button>
            </div>
        </div>
    </div>
    <div v-if="show" class="dialog-overlay" @click="closeDialog"></div>
</template>

<script>
import {
    CONFIG_KEY,
    STORAGE_KEYS,
    writeSetting,
    writeSegmentValue,
    readSegmentValue,
    readSegmentBreaks,
    writeSegmentBreaks,
    newBreakId,
    computeSegments,
    findSegmentForPage,
} from '../utils/constants';

const { TARGET_COMPLETIONS, PRESENTATION_STARTS, SLIDE_TIMES } = STORAGE_KEYS;

export default {
    name: 'SettingsDialog',
    props: {
        show: {
            type: Boolean,
            default: false
        }
    },
    emits: ['close', 'settings-updated'],
    data() {
        return {
            segmentConfigs: [],
            showHelp: false,
            showImport: false,
            importJson: '',
            importError: '',
            showConfirmDialog: false,
            confirmationTitle: '',
            confirmationMessage: '',
            confirmationAction: '',
            pendingAction: null,
            showNotification: false,
            notificationTitle: '',
            notificationMessage: '',
        };
    },
    computed: {
        segments() {
            return computeSegments(this.$slidev?.nav?.slides ?? []);
        },
        currentSegment() {
            return findSegmentForPage(this.segments, this.$slidev?.nav?.currentPage ?? 1);
        },
        isDarkMode() {
            const body = document.body;
            const html = document.documentElement;
            return body.classList.contains('dark') ||
                html.classList.contains('dark') ||
                body.classList.contains('dark-mode') ||
                html.classList.contains('dark-mode') ||
                html.getAttribute('data-theme') === 'dark' ||
                body.getAttribute('data-theme') === 'dark';
        }
    },
    methods: {
        closeDialog() {
            this.$emit('close');
        },

        loadAllSegmentConfigs() {
            this.segmentConfigs = this.segments.map(seg => {
                const storedStart = readSegmentValue(PRESENTATION_STARTS, seg.index);
                const storedTarget = readSegmentValue(TARGET_COMPLETIONS, seg.index);
                return {
                    index: seg.index,
                    label: seg.label,
                    start: seg.start,
                    end: seg.end,
                    startInput: storedStart
                        ? this.formatDateForLocalInput(new Date(parseInt(storedStart)))
                        : '',
                    useTargetCompletion: !!storedTarget,
                    targetInput: this.formatDateForLocalInput(
                        new Date(storedTarget ? parseInt(storedTarget) : Date.now() + 60 * 60 * 1000)
                    ),
                    breaks: readSegmentBreaks(seg.index).map(b => ({
                        ...b,
                        startInput: this.formatDateForLocalInput(new Date(b.startTime)),
                    })),
                };
            });
        },

        saveSettings() {
            for (const seg of this.segmentConfigs) {
                if (seg.startInput) {
                    writeSegmentValue(PRESENTATION_STARTS, seg.index, new Date(seg.startInput).getTime());
                } else {
                    writeSegmentValue(PRESENTATION_STARTS, seg.index, null);
                }

                if (seg.useTargetCompletion) {
                    writeSegmentValue(TARGET_COMPLETIONS, seg.index, new Date(seg.targetInput).getTime());
                } else {
                    writeSegmentValue(TARGET_COMPLETIONS, seg.index, null);
                }

                const persistedBreaks = seg.breaks
                    .filter(b => b.startInput && b.durationMinutes > 0)
                    .map(b => {
                        const out = {
                            id: b.id,
                            startTime: new Date(b.startInput).getTime(),
                            durationMinutes: Number(b.durationMinutes),
                        };
                        if (b.raisedAt) out.raisedAt = b.raisedAt;
                        if (b.dismissedAt) out.dismissedAt = b.dismissedAt;
                        return out;
                    });
                writeSegmentBreaks(seg.index, persistedBreaks);
            }

            this.$emit('settings-updated');
            this.closeDialog();
        },

        setStartNow(seg) {
            seg.startInput = this.formatDateForLocalInput(new Date());
        },

        addBreak(seg) {
            const defaultStart = Date.now() + 60 * 60 * 1000;
            seg.breaks.push({
                id: newBreakId(),
                startInput: this.formatDateForLocalInput(new Date(defaultStart)),
                durationMinutes: 15,
            });
        },

        removeBreak(seg, index) {
            seg.breaks.splice(index, 1);
        },

        // Export per-segment configs (start, target, breaks) as JSON for
        // reuse across teaching sessions. Distinct from "export slide times"
        // which dumps recorded slide timing data.
        exportConfigs() {
            const exportData = {
                version: 1,
                exportedAt: new Date().toISOString(),
                segments: this.segments.map(seg => {
                    const start = readSegmentValue(PRESENTATION_STARTS, seg.index);
                    const target = readSegmentValue(TARGET_COMPLETIONS, seg.index);
                    return {
                        index: seg.index,
                        label: seg.label,
                        presentationStart: start ? parseInt(start) : null,
                        targetCompletion: target ? parseInt(target) : null,
                        breaks: readSegmentBreaks(seg.index),
                    };
                }),
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = `pacer-settings-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);
        },

        applyImport() {
            this.importError = '';
            let parsed;
            try {
                parsed = JSON.parse(this.importJson);
            } catch (e) {
                this.importError = `Invalid JSON: ${e.message}`;
                return;
            }
            if (!parsed || !Array.isArray(parsed.segments)) {
                this.importError = 'Expected an object with a "segments" array.';
                return;
            }

            try {
                for (const seg of parsed.segments) {
                    if (typeof seg.index !== 'number') continue;
                    writeSegmentValue(PRESENTATION_STARTS, seg.index, seg.presentationStart ?? null);
                    writeSegmentValue(TARGET_COMPLETIONS, seg.index, seg.targetCompletion ?? null);
                    writeSegmentBreaks(seg.index, Array.isArray(seg.breaks) ? seg.breaks : []);
                }
            } catch (e) {
                this.importError = `Import failed: ${e.message}`;
                return;
            }

            this.showImport = false;
            this.importJson = '';
            this.loadAllSegmentConfigs();
            this.showNotificationDialog('Import complete', `Applied settings to ${parsed.segments.length} segment(s).`);
        },

        clearSlideTimes() {
            this.showConfirmation(
                'Clear all slide times',
                'Are you sure you want to clear all stored slide timing data? This action cannot be undone.',
                'Clear all',
                () => {
                    writeSetting(SLIDE_TIMES, null);
                    this.showNotificationDialog('Cleared', 'All slide timing data has been cleared.');
                }
            );
        },

        exportSlideTimes() {
            const savedTimes = localStorage.getItem(SLIDE_TIMES);
            if (!savedTimes) {
                this.showNotificationDialog('No data', 'No slide timing data available to export.');
                return;
            }

            try {
                const slideTimes = JSON.parse(savedTimes);
                const slidevNav = this.$slidev?.nav;
                const slidevConfigs = this.$slidev?.configs;
                if (!slidevNav || !slidevNav.slides) {
                    throw new Error('Unable to access Slidev navigation data');
                }

                const slides = slidevNav.slides;
                const defaultSlideTime = slidevConfigs?.[CONFIG_KEY]?.defaultSlideTime || 2;
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

                const exportData = {
                    metadata: {
                        exportDate: now.toISOString(),
                        totalSlides: slides.length,
                        slidesWithRecordedTimes: Object.keys(slideTimes).length,
                        presentationStarts: localStorage.getItem(PRESENTATION_STARTS) || null,
                        targetCompletions: localStorage.getItem(TARGET_COMPLETIONS) || null,
                        segments: this.segments,
                    },
                    slideData: [],
                    summary: {
                        totalPlannedTime: 0,
                        totalActualTime: 0,
                        totalVariance: 0,
                        slidesAhead: 0,
                        slidesBehind: 0,
                        slidesOnTime: 0,
                        averagePlannedTime: 0,
                        averageActualTime: 0,
                        averageVariance: 0,
                    },
                };

                const segmentCumulativeTime = new Map();
                slides.forEach((slide, index) => {
                    const slideNum = index + 1;
                    const slideTitle = slide.meta?.slide?.frontmatter?.title || `Slide ${slideNum}`;
                    const plannedTimeMin = slide.meta?.slide?.frontmatter?.slideTime || defaultSlideTime;
                    const actualTimeSec = slideTimes[slideNum] || 0;
                    const actualTimeMin = actualTimeSec / 60;
                    const variance = plannedTimeMin - actualTimeMin;

                    const seg = findSegmentForPage(this.segments, slideNum);
                    const segStart = readSegmentValue(PRESENTATION_STARTS, seg.index);
                    const startTimestamp = segStart ? parseInt(segStart) : null;

                    let slideStartTime = null;
                    let slideEndTime = null;
                    let slideStartTimestamp = null;
                    let slideEndTimestamp = null;

                    if (startTimestamp && actualTimeSec > 0) {
                        const cumulative = segmentCumulativeTime.get(seg.index) ?? 0;
                        slideStartTimestamp = startTimestamp + (cumulative * 1000);
                        slideEndTimestamp = slideStartTimestamp + (actualTimeSec * 1000);
                        slideStartTime = new Date(slideStartTimestamp).toISOString();
                        slideEndTime = new Date(slideEndTimestamp).toISOString();
                        segmentCumulativeTime.set(seg.index, cumulative + actualTimeSec);
                    }

                    exportData.summary.totalPlannedTime += plannedTimeMin;
                    exportData.summary.totalActualTime += actualTimeMin;
                    exportData.summary.totalVariance += variance;
                    if (variance > 0.25) exportData.summary.slidesAhead++;
                    else if (variance < -0.25) exportData.summary.slidesBehind++;
                    else exportData.summary.slidesOnTime++;

                    exportData.slideData.push({
                        slideNumber: slideNum,
                        title: slideTitle,
                        segmentIndex: seg.index,
                        segmentLabel: seg.label,
                        plannedTimeMinutes: plannedTimeMin,
                        actualTimeSeconds: actualTimeSec,
                        actualTimeMinutes: actualTimeMin,
                        variance,
                        varianceSeconds: variance * 60,
                        status: variance > 0.25 ? 'ahead' : (variance < -0.25 ? 'behind' : 'on-time'),
                        slideStartTime,
                        slideEndTime,
                        slideStartTimestamp,
                        slideEndTimestamp,
                        hasRecordedTime: actualTimeSec > 0,
                    });
                });

                if (exportData.slideData.length > 0) {
                    exportData.summary.averagePlannedTime = exportData.summary.totalPlannedTime / exportData.slideData.length;
                    exportData.summary.averageActualTime = exportData.summary.totalActualTime / exportData.slideData.length;
                    exportData.summary.averageVariance = exportData.summary.totalVariance / exportData.slideData.length;
                }

                const jsonStr = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const slidesCount = exportData.metadata.totalSlides;
                const recordedCount = exportData.metadata.slidesWithRecordedTimes;
                const filename = `pacer-timing-${slidesCount}slides-${recordedCount}recorded-${dateStr}-${timeStr}.json`;

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 0);

                this.showNotificationDialog('Export complete', `Slide timing data exported as "${filename}".`);
            } catch (e) {
                console.error('Error exporting slide times:', e);
                this.showNotificationDialog('Export error', `Error exporting slide times: ${e.message}`);
            }
        },

        showConfirmation(title, message, actionText, callback) {
            this.confirmationTitle = title;
            this.confirmationMessage = message;
            this.confirmationAction = actionText;
            this.pendingAction = callback;
            this.showConfirmDialog = true;
        },

        confirmAction() {
            if (this.pendingAction) this.pendingAction();
            this.cancelConfirmation();
        },

        cancelConfirmation() {
            this.showConfirmDialog = false;
            this.confirmationTitle = '';
            this.confirmationMessage = '';
            this.confirmationAction = '';
            this.pendingAction = null;
        },

        showNotificationDialog(title, message) {
            this.notificationTitle = title;
            this.notificationMessage = message;
            this.showNotification = true;
        },

        closeNotification() {
            this.showNotification = false;
            this.notificationTitle = '';
            this.notificationMessage = '';
        },

        formatDateForLocalInput(date) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        },
    },
    watch: {
        show: {
            handler(newShow) {
                if (newShow) {
                    this.loadAllSegmentConfigs();
                    this.showHelp = false;
                    this.showImport = false;
                    this.importJson = '';
                    this.importError = '';
                }
            },
            immediate: true,
        }
    }
}
</script>

<style scoped>
.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 8px;
}

.dialog-header h3 {
    margin: 0;
}

.dialog-header-actions {
    display: flex;
    gap: 6px;
}

.header-action-button {
    padding: 4px 10px;
    font-size: 0.75rem;
    background: transparent;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    color: #374151;
    cursor: pointer;
}

.header-action-button:hover {
    background: #f3f4f6;
}

.dark-mode .header-action-button {
    border-color: #4b5563;
    color: #d1d5db;
}

.dark-mode .header-action-button:hover {
    background: #374151;
}

.help-panel {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 12px;
    font-size: 0.85rem;
    line-height: 1.5;
}

.help-panel p {
    margin: 0 0 8px 0;
}

.help-panel ul {
    margin: 4px 0 8px 0;
    padding-left: 20px;
}

.help-panel li {
    margin: 2px 0;
}

.help-panel code {
    font-family: 'Courier New', monospace;
    background: rgba(0, 0, 0, 0.08);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.85em;
}

.dark-mode .help-panel {
    background: #1f2937;
    border-color: #374151;
    color: #d1d5db;
}

.dark-mode .help-panel code {
    background: rgba(255, 255, 255, 0.08);
}

.import-panel {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 12px;
}

.import-textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #ffffff;
    color: #111827;
    resize: vertical;
}

.dark-mode .import-panel {
    background: #422006;
    border-color: #78350f;
    color: #fef3c7;
}

.dark-mode .import-textarea {
    background: #1f2937;
    border-color: #4b5563;
    color: #f9fafb;
}

.import-error {
    color: #b91c1c;
    font-size: 0.8rem;
    margin-top: 6px;
}

.dark-mode .import-error {
    color: #fca5a5;
}

.import-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
}

.apply-import {
    background: #fcd34d;
    border-color: #f59e0b;
    color: #78350f;
    font-weight: 600;
}

.segment-section {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 12px;
}

.segment-section.is-current {
    border-color: #21cab9;
    box-shadow: 0 0 0 1px #21cab9;
}

.dark-mode .segment-section {
    border-color: #374151;
}

.dark-mode .segment-section.is-current {
    border-color: #21cab9;
    box-shadow: 0 0 0 1px #21cab9;
}

.segment-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
}

.dark-mode .segment-header {
    border-bottom-color: #374151;
}

.segment-title {
    font-weight: 600;
    font-size: 1rem;
}

.segment-current-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
    background: #21cab9;
    color: #080c16;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
}

.segment-pages {
    font-size: 0.75rem;
    color: #6b7280;
    margin-left: auto;
}

.dark-mode .segment-pages {
    color: #9ca3af;
}

.segment-field {
    margin: 10px 0;
}

.segment-field label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 4px;
}

.segment-field label.checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
}

.field-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.field-row.indented {
    margin-left: 22px;
    margin-top: 4px;
}

.field-sep {
    color: #6b7280;
    font-size: 0.85rem;
}

.small-button {
    padding: 4px 8px;
    font-size: 0.8rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #f8f9fa;
    cursor: pointer;
    transition: background-color 0.15s;
}

.small-button:hover {
    background: #e9ecef;
}

.dark-mode .small-button {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
}

.dark-mode .small-button:hover {
    background: #4b5563;
}

.help-text {
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 4px;
    margin-bottom: 6px;
}

.dark-mode .help-text {
    color: #9ca3af;
}

.no-breaks {
    font-size: 0.85rem;
    color: #9ca3af;
    font-style: italic;
    margin: 4px 0;
}

.break-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 6px 0;
}

.break-start {
    flex: 1;
    min-width: 0;
}

.break-duration {
    width: 60px;
}

.break-unit {
    font-size: 0.8rem;
    color: #6b7280;
}

.dark-mode .break-unit {
    color: #9ca3af;
}

.break-state {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 3px;
    background: #e5e7eb;
    color: #374151;
}

.break-state.active {
    background: #fef3c7;
    color: #92400e;
}

.break-state.past {
    background: #d1d5db;
    color: #6b7280;
}

.dark-mode .break-state {
    background: #374151;
    color: #d1d5db;
}

.dark-mode .break-state.active {
    background: #78350f;
    color: #fef3c7;
}

.dark-mode .break-state.past {
    background: #1f2937;
    color: #6b7280;
}

.break-remove {
    background: transparent;
    border: 1px solid #d1d5db;
    color: #6b7280;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.break-remove:hover {
    background: #fee2e2;
    border-color: #ef4444;
    color: #b91c1c;
}

.dark-mode .break-remove {
    border-color: #4b5563;
    color: #9ca3af;
}

.dark-mode .break-remove:hover {
    background: #7f1d1d;
    border-color: #b91c1c;
    color: #fecaca;
}

.add-break-button {
    margin-top: 6px;
}

.management-section {
    border-top: 1px solid #e5e7eb;
    padding-top: 12px;
    margin-top: 16px;
}

.dark-mode .management-section {
    border-top-color: #374151;
}

.management-section h4 {
    margin: 0 0 6px 0;
    font-size: 0.95rem;
}

.slide-time-management {
    display: flex;
    gap: 8px;
    margin-top: 4px;
}

.management-button {
    padding: 6px 12px;
    font-size: 0.85rem;
    border-radius: 4px;
    border: 1px solid;
    cursor: pointer;
    transition: all 0.15s ease;
    font-weight: 500;
}

.danger-button {
    background: #ef4444;
    color: white;
    border-color: #dc2626;
}

.danger-button:hover {
    background: #dc2626;
}

.export-button {
    background: #3b82f6;
    color: white;
    border-color: #2563eb;
}

.export-button:hover {
    background: #2563eb;
}

.dark-mode .danger-button {
    background: #b91c1c;
    border-color: #991b1b;
}

.dark-mode .export-button {
    background: #3b82f6;
    border-color: #2563eb;
}

.dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
}

.dark-mode .dialog-buttons {
    border-top-color: #374151;
}

.dialog-buttons .primary-button {
    background: #21cab9;
    color: #080c16;
    border: 1px solid #1ba99a;
    font-weight: 600;
}

.dialog-buttons .primary-button:hover {
    background: #1ba99a;
}

.confirmation-overlay,
.notification-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
}

.confirmation-dialog,
.notification-dialog {
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.confirmation-dialog h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: #ef4444;
}

.notification-dialog h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: #059669;
}

.confirmation-dialog p,
.notification-dialog p {
    margin: 0 0 20px 0;
    color: #374151;
    line-height: 1.5;
}

.confirmation-buttons,
.notification-buttons {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.cancel-button {
    padding: 8px 16px;
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    cursor: pointer;
}

.confirm-button {
    padding: 8px 16px;
    background: #ef4444;
    color: white;
    border: 1px solid #dc2626;
    border-radius: 4px;
    cursor: pointer;
}

.notification-button {
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: 1px solid #2563eb;
    border-radius: 4px;
    cursor: pointer;
}

.dark-mode .confirmation-dialog,
.dark-mode .notification-dialog {
    background: #2d3748;
    color: #f7fafc;
}

.dark-mode .confirmation-dialog p,
.dark-mode .notification-dialog p {
    color: #e2e8f0;
}

.dark-mode .cancel-button {
    background: #4a5568;
    color: #f7fafc;
    border-color: #718096;
}
</style>
