<template>
    <!-- Configuration Dialog -->
    <div v-if="show" class="config-dialog" :class="{ 'dark-mode': isDarkMode }" @click.stop>
        <div class="dialog-content">
            <h3>Presentation Timer Settings</h3>
            <p v-if="hasMultipleSegments" class="segment-scope-note">
                Editing: <strong>{{ currentSegment.label }}</strong> (segment {{ currentSegment.index + 1 }} of {{ segments.length }})
            </p>

            <!-- Presentation Start Time Section -->
            <div class="time-inputs">
                <label>
                    <span>Presentation Start Time:</span>
                </label>
                <div class="start-time-section">
                    <button @click="setStartTimeNow" class="small-button">Start Now</button>
                    <span style="margin: 0 8px;">or</span>
                    <input type="datetime-local" v-model="presentationStartInput" />
                    <button @click="clearStartTime" class="small-button">Clear</button>
                </div>
                <p class="help-text">Set when the presentation should begin. Slide timers will be paused until this
                    time.</p>
            </div>

            <!-- Target Completion Time Section -->
            <div class="time-inputs">
                <label class="checkbox-label">
                    <input type="checkbox" v-model="useTargetCompletion" />
                    <span>Set target completion time (for time banking)</span>
                </label>
                <div v-if="useTargetCompletion" class="target-completion-section">
                    <p>Target completion time:</p>
                    <input type="datetime-local" v-model="targetCompletionInput" />
                </div>
            </div>

            <!-- Slide Time Management -->
            <div class="time-inputs">
                <h4>Slide Time Management</h4>
                <div class="slide-time-management">
                    <button @click="clearSlideTimes" class="management-button danger-button">Clear All Slide Times</button>
                    <button @click="exportSlideTimes" class="management-button export-button">Export Slide Times</button>
                </div>
                <p class="help-text">Clear all stored slide timing data or export it for analysis.</p>
            </div>

            <!-- Confirmation Dialog -->
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

            <!-- Notification Dialog -->
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
                <button @click="saveSettings">Save</button>
                <button @click="resetSettings">Reset</button>
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
            useTargetCompletion: false,
            targetCompletionInput: '',
            presentationStartInput: '',
            // Confirmation dialog state
            showConfirmDialog: false,
            confirmationTitle: '',
            confirmationMessage: '',
            confirmationAction: '',
            pendingAction: null,
            // Notification dialog state
            showNotification: false,
            notificationTitle: '',
            notificationMessage: ''
        }
    },
    computed: {
        segments() {
            return computeSegments(this.$slidev?.nav?.slides ?? []);
        },
        currentSegment() {
            return findSegmentForPage(this.segments, this.$slidev?.nav?.currentPage ?? 1);
        },
        hasMultipleSegments() {
            return this.segments.length > 1;
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

        saveSettings() {
            const segIdx = this.currentSegment.index;

            if (this.useTargetCompletion) {
                writeSegmentValue(TARGET_COMPLETIONS, segIdx, new Date(this.targetCompletionInput).getTime());
            } else {
                writeSegmentValue(TARGET_COMPLETIONS, segIdx, null);
            }

            if (this.presentationStartInput) {
                writeSegmentValue(PRESENTATION_STARTS, segIdx, new Date(this.presentationStartInput).getTime());
            }

            this.$emit('settings-updated');
            this.closeDialog();
        },

        resetSettings() {
            const segIdx = this.currentSegment.index;
            writeSegmentValue(TARGET_COMPLETIONS, segIdx, null);
            writeSegmentValue(PRESENTATION_STARTS, segIdx, null);

            this.useTargetCompletion = false;
            this.presentationStartInput = '';
            this.closeDialog();
        },

        setStartTimeNow() {
            const now = Date.now();
            writeSegmentValue(PRESENTATION_STARTS, this.currentSegment.index, now);
            this.presentationStartInput = this.formatDateForLocalInput(new Date(now));
        },

        clearStartTime() {
            writeSegmentValue(PRESENTATION_STARTS, this.currentSegment.index, null);
            this.presentationStartInput = '';
        },

        clearSlideTimes() {
            this.showConfirmation(
                'Clear All Slide Times',
                'Are you sure you want to clear all slide timing data? This action cannot be undone.',
                'Clear All',
                () => {
                    writeSetting(SLIDE_TIMES, null);
                    this.showNotificationDialog('Success', 'All slide timing data has been cleared.');
                }
            );
        },

        exportSlideTimes() {
            const savedTimes = localStorage.getItem(SLIDE_TIMES);
            if (!savedTimes) {
                this.showNotificationDialog('No Data', 'No slide timing data available to export.');
                return;
            }

            try {
                const slideTimes = JSON.parse(savedTimes);
                
                // Access Slidev data through the component instance
                const slidevNav = this.$slidev?.nav;
                const slidevConfigs = this.$slidev?.configs;
                
                if (!slidevNav || !slidevNav.slides) {
                    throw new Error('Unable to access Slidev navigation data');
                }
                
                const slides = slidevNav.slides;
                const defaultSlideTime = slidevConfigs?.[CONFIG_KEY]?.defaultSlideTime || 2;

                // Format current date and time for filename
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

                // Build comprehensive export data
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
                        averageVariance: 0
                    }
                };

                // Process each slide. Absolute slide start/end timestamps are
                // anchored per segment to its own presentation-start setting.
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

                    // Add to summary
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
                        variance: variance,
                        varianceSeconds: variance * 60,
                        status: variance > 0.25 ? 'ahead' : (variance < -0.25 ? 'behind' : 'on-time'),
                        slideStartTime: slideStartTime,
                        slideEndTime: slideEndTime,
                        slideStartTimestamp: slideStartTimestamp,
                        slideEndTimestamp: slideEndTimestamp,
                        hasRecordedTime: actualTimeSec > 0
                    });
                });

                // Calculate averages
                if (exportData.slideData.length > 0) {
                    exportData.summary.averagePlannedTime = exportData.summary.totalPlannedTime / exportData.slideData.length;
                    exportData.summary.averageActualTime = exportData.summary.totalActualTime / exportData.slideData.length;
                    exportData.summary.averageVariance = exportData.summary.totalVariance / exportData.slideData.length;
                }

                // Convert to JSON and create download
                const jsonStr = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                // Create descriptive filename
                const slidesCount = exportData.metadata.totalSlides;
                const recordedCount = exportData.metadata.slidesWithRecordedTimes;
                const filename = `slidev-timing-report-${slidesCount}slides-${recordedCount}recorded-${dateStr}-${timeStr}.json`;

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();

                // Clean up
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 0);

                this.showNotificationDialog('Export Complete', `Slide timing data exported successfully as "${filename}".`);
            } catch (e) {
                console.error('Error exporting slide times:', e);
                this.showNotificationDialog('Export Error', `Error exporting slide times: ${e.message}`);
            }
        },

        // Confirmation dialog methods
        showConfirmation(title, message, actionText, callback) {
            this.confirmationTitle = title;
            this.confirmationMessage = message;
            this.confirmationAction = actionText;
            this.pendingAction = callback;
            this.showConfirmDialog = true;
        },

        confirmAction() {
            if (this.pendingAction) {
                this.pendingAction();
            }
            this.cancelConfirmation();
        },

        cancelConfirmation() {
            this.showConfirmDialog = false;
            this.confirmationTitle = '';
            this.confirmationMessage = '';
            this.confirmationAction = '';
            this.pendingAction = null;
        },

        // Notification dialog methods
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
            // Format date for datetime-local input in local timezone
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        },

        loadInputsForCurrentSegment() {
            const segIdx = this.currentSegment.index;

            const storedStart = readSegmentValue(PRESENTATION_STARTS, segIdx);
            this.presentationStartInput = storedStart
                ? this.formatDateForLocalInput(new Date(parseInt(storedStart)))
                : '';

            const storedTarget = readSegmentValue(TARGET_COMPLETIONS, segIdx);
            this.useTargetCompletion = !!storedTarget;

            const targetDate = new Date();
            targetDate.setTime(storedTarget ? parseInt(storedTarget) : Date.now() + (60 * 60 * 1000));
            this.targetCompletionInput = this.formatDateForLocalInput(targetDate);
        }
    },
    watch: {
        // Reload inputs each time the dialog opens, scoped to the current segment.
        show: {
            handler(newShow) {
                if (newShow) {
                    this.loadInputsForCurrentSegment();
                }
            },
            immediate: true
        }
    }
}
</script>

<style scoped>
.segment-scope-note {
    font-size: 0.85rem;
    color: #6b7280;
    margin: -8px 0 12px 0;
}

.dark-mode .segment-scope-note {
    color: #9ca3af;
}

.start-time-section {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
}

.small-button {
    padding: 4px 8px;
    font-size: 0.8rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #f8f9fa;
    cursor: pointer;
    transition: background-color 0.2s;
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
    margin-bottom: 0;
}

.dark-mode .help-text {
    color: #9ca3af;
}

.slide-time-management {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.management-button {
    padding: 6px 12px;
    font-size: 0.85rem;
    border-radius: 4px;
    border: 1px solid;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
    min-width: 120px;
}

.danger-button {
    background: #ef4444;
    color: white;
    border-color: #dc2626;
}

.danger-button:hover {
    background: #dc2626;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
}

.export-button {
    background: #3b82f6;
    color: white;
    border-color: #2563eb;
}

.export-button:hover {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}

.dark-mode .danger-button {
    background: #b91c1c;
    border-color: #991b1b;
}

.dark-mode .danger-button:hover {
    background: #991b1b;
    box-shadow: 0 2px 4px rgba(153, 27, 27, 0.3);
}

.dark-mode .export-button {
    background: #3b82f6;
    border-color: #2563eb;
}

.dark-mode .export-button:hover {
    background: #2563eb;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
}

/* Confirmation Dialog */
.confirmation-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
}

.confirmation-dialog {
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    transition: background-color 0.2s ease, color 0.2s ease;
}

.confirmation-dialog h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    font-weight: 600;
    color: #ef4444;
}

.confirmation-dialog p {
    margin: 0 0 20px 0;
    color: #374151;
    line-height: 1.5;
}

.confirmation-buttons {
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
    transition: background-color 0.2s ease;
}

.cancel-button:hover {
    background: #e5e7eb;
}

.confirm-button {
    padding: 8px 16px;
    background: #ef4444;
    color: white;
    border: 1px solid #dc2626;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.confirm-button:hover {
    background: #dc2626;
}

/* Notification Dialog */
.notification-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
}

.notification-dialog {
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    transition: background-color 0.2s ease, color 0.2s ease;
}

.notification-dialog h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    font-weight: 600;
    color: #059669;
}

.notification-dialog p {
    margin: 0 0 20px 0;
    color: #374151;
    line-height: 1.5;
}

.notification-buttons {
    display: flex;
    justify-content: flex-end;
}

.notification-button {
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: 1px solid #2563eb;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.notification-button:hover {
    background: #2563eb;
}

/* Dark mode styles for dialogs */
.dark-mode .confirmation-dialog,
.dark-mode .notification-dialog {
    background: #2d3748;
    color: #f7fafc;
}

.dark-mode .confirmation-dialog h3 {
    color: #fc8181;
}

.dark-mode .notification-dialog h3 {
    color: #68d391;
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

.dark-mode .cancel-button:hover {
    background: #718096;
}

.dark-mode .confirm-button {
    background: #e53e3e;
    border-color: #c53030;
}

.dark-mode .confirm-button:hover {
    background: #c53030;
}
</style>