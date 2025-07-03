/**
 * Loading Utilities for Court Assistant Application
 * Common loading functions and states
 */

class LoadingUtils {
    /**
     * Show loading state on a button
     * @param {HTMLElement} button - The button element
     * @param {string} loadingText - Text to show while loading
     * @param {string} originalText - Original button text to restore
     */
    static showButtonLoading(button, loadingText = 'Loading...', originalText = null) {
        if (!button) return;
        
        // Store original text if not provided
        if (!originalText) {
            originalText = button.textContent || button.innerHTML;
        }
        
        button.dataset.originalText = originalText;
        button.classList.add('btn-loading');
        button.textContent = loadingText;
        button.disabled = true;
    }

    /**
     * Hide loading state on a button
     * @param {HTMLElement} button - The button element
     */
    static hideButtonLoading(button) {
        if (!button) return;
        
        const originalText = button.dataset.originalText || 'Submit';
        button.classList.remove('btn-loading');
        button.textContent = originalText;
        button.disabled = false;
        delete button.dataset.originalText;
    }

    /**
     * Show loading container
     * @param {HTMLElement} container - The container element
     * @param {string} message - Loading message
     */
    static showContainerLoading(container, message = 'Loading...') {
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
                <div class="loading-text">
                    <span>${message}</span>
                </div>
            </div>
        `;
    }

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     * @param {string} overlayId - ID for the overlay element
     */
    static showOverlayLoading(message = 'Processing...', overlayId = 'loadingOverlay') {
        let overlay = document.getElementById(overlayId);
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = overlayId;
            overlay.className = 'loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
            `;
            document.body.appendChild(overlay);
        }
        
        overlay.innerHTML = `
            <div class="spinner" style="
                width: 40px;
                height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #1a73e8;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <p style="margin-top: 1rem; font-size: 1rem;">${message}</p>
        `;
        
        overlay.style.display = 'flex';
    }

    /**
     * Hide loading overlay
     * @param {string} overlayId - ID for the overlay element
     */
    static hideOverlayLoading(overlayId = 'loadingOverlay') {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Show loading state on form submission
     * @param {HTMLFormElement} form - The form element
     * @param {string} loadingText - Text to show while loading
     */
    static showFormLoading(form, loadingText = 'Submitting...') {
        if (!form) return;
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            this.showButtonLoading(submitBtn, loadingText);
        }
    }

    /**
     * Hide loading state on form submission
     * @param {HTMLFormElement} form - The form element
     */
    static hideFormLoading(form) {
        if (!form) return;
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            this.hideButtonLoading(submitBtn);
        }
    }

    /**
     * Show loading state on a select dropdown
     * @param {HTMLSelectElement} select - The select element
     * @param {string} loadingText - Text to show while loading
     */
    static showSelectLoading(select, loadingText = 'Loading...') {
        if (!select) return;
        
        select.innerHTML = `<option value="" disabled>${loadingText}</option>`;
        select.disabled = true;
    }

    /**
     * Hide loading state on a select dropdown
     * @param {HTMLSelectElement} select - The select element
     */
    static hideSelectLoading(select) {
        if (!select) return;
        
        select.disabled = false;
    }

    /**
     * Show error state on a select dropdown
     * @param {HTMLSelectElement} select - The select element
     * @param {string} errorText - Error text to show
     */
    static showSelectError(select, errorText = 'Failed to load') {
        if (!select) return;
        
        select.innerHTML = `<option value="" disabled>${errorText}</option>`;
        select.disabled = true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingUtils;
} else {
    window.LoadingUtils = LoadingUtils;
} 