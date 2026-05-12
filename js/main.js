/**
 * MainInterface Component
 * 
 * Manages the main interface and modal interactions for the AI Invoice Extraction system.
 * Provides methods to initialize the interface, open and close the extraction view modal.
 * 
 * Requirements: 1.1, 1.2
 */
class MainInterface {
  constructor() {
    this.modal = null;
    this.btnOpen = null;
    this.btnClose = null;
    this.extractionFrame = null;
  }

  /**
   * Initializes the main interface
   * Sets up event listeners for buttons and modal interactions
   */
  initialize() {
    // Get DOM elements
    this.modal = document.getElementById('extractionModal');
    this.btnOpen = document.getElementById('btnAltaFacturasIA');
    this.btnClose = document.getElementById('btnCloseModal');
    this.extractionFrame = document.getElementById('extractionFrame');

    // Verify all required elements exist
    if (!this.modal || !this.btnOpen || !this.btnClose) {
      console.error('MainInterface: Required DOM elements not found');
      return;
    }

    // Set up event listeners
    this.setupEventListeners();

    console.log('MainInterface initialized successfully');
  }

  /**
   * Sets up all event listeners for the interface
   * @private
   */
  setupEventListeners() {
    // Open modal when "Alta Facturas IA" button is clicked
    this.btnOpen.addEventListener('click', () => {
      this.openExtractionView();
    });

    // Close modal when close button (×) is clicked
    this.btnClose.addEventListener('click', () => {
      this.closeExtractionView();
    });

    // Close modal when clicking outside the modal content
    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) {
        this.closeExtractionView();
      }
    });

    // Close modal when ESC key is pressed
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isModalOpen()) {
        this.closeExtractionView();
      }
    });

    // Listen for invoice-saved message from iframe and refresh the list
    window.addEventListener('message', (event) => {
      if (event.data === 'invoice-saved') {
        console.log('Invoice saved in iframe — refreshing list...');
        // Call loadFacturas if available (defined in facturas-proveedor.js scope)
        if (typeof window.reloadFacturas === 'function') {
          window.reloadFacturas();
        }
      }
    });
  }

  /**
   * Opens the extraction view modal
   * Shows the modal with the extraction view loaded in an iframe
   */
  openExtractionView() {
    if (!this.modal) {
      console.error('MainInterface: Modal element not found');
      return;
    }

    // Show the modal
    this.modal.style.display = 'flex';

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Trigger file selection in the iframe
    if (this.extractionFrame && this.extractionFrame.contentWindow) {
      // Small delay to ensure the iframe is ready to receive messages
      setTimeout(() => {
        this.extractionFrame.contentWindow.postMessage('open-file-dialog', '*');
      }, 500);
    }

    console.log('Extraction view opened and file dialog triggered');
  }

  /**
   * Closes the extraction view modal
   * Hides the modal and restores normal page behavior
   */
  closeExtractionView() {
    if (!this.modal) {
      console.error('MainInterface: Modal element not found');
      return;
    }

    // Hide the modal
    this.modal.style.display = 'none';

    // Restore body scroll
    document.body.style.overflow = '';

    // Reset the iframe so it starts clean next time
    if (this.extractionFrame) {
      const src = this.extractionFrame.src;
      this.extractionFrame.src = '';
      this.extractionFrame.src = src;
    }

    console.log('Extraction view closed and reset');
  }

  /**
   * Checks if the modal is currently open
   * @private
   * @returns {boolean} True if modal is open, false otherwise
   */
  isModalOpen() {
    return this.modal && this.modal.style.display === 'flex';
  }
}

// Initialize the MainInterface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const mainInterface = new MainInterface();
  mainInterface.initialize();
});
