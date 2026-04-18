import { useEffect, useState } from 'react';
import { CheckCircle, FileImage, FileText, ScanSearch, Send, ShieldAlert, WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { postJson } from '../utils/api';

const OFFLINE_INTAKE_QUEUE_KEY = 'resourcesync_offline_intake_queue';

const initialFormState = {
  title: '',
  location: '',
  category: 'Medical',
  urgency: 'Low',
  notes: '',
  volunteersNeeded: 1,
  requiredBadge: 'First Aid Ready'
};

const badgeOptionsByCategory = {
  Medical: 'First Aid Ready',
  Food: 'Food Safety Steward',
  Education: 'Child Support Ally',
  Logistics: '',
  Labor: ''
};

export default function DataIntake() {
  const [submitted, setSubmitted] = useState(false);
  const [formValues, setFormValues] = useState(initialFormState);
  const [scanStatus, setScanStatus] = useState('Upload a field report image to auto-fill the intake form.');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [submitMode, setSubmitMode] = useState('manual');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(readOfflineQueue().length);
  const { currentUser, getToken, hasPermission } = useAuth();
  const canUseIntake = hasPermission('intake_access');

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine && readOfflineQueue().length) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: name === 'volunteersNeeded' ? Number(value) || '' : value,
      ...(name === 'category' ? { requiredBadge: badgeOptionsByCategory[value] ?? '' } : {})
    }));
  };

  const handleOCRUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !canUseIntake) return;

    setSelectedFileName(file.name);
    setIsScanning(true);
    setScanStatus(`Scanning ${file.name} with Gemini OCR...`);

    try {
      const token = await getToken();
      const { imageData, mimeType } = await fileToUploadPayload(file);

      const data = await postJson('/api/ocr/need', {
        fileName: file.name,
        mimeType,
        imageData
      }, { token, timeoutMs: 30000 });

      setFormValues({
        title: data.extractedFields.title || '',
        location: data.extractedFields.location || '',
        category: data.extractedFields.category || 'Medical',
        urgency: data.extractedFields.urgency || 'Medium',
        notes: data.extractedFields.notes || '',
        volunteersNeeded: data.extractedFields.volunteersNeeded || 1,
        requiredBadge: data.extractedFields.requiredBadge ?? (badgeOptionsByCategory[data.extractedFields.category || 'Medical'] ?? '')
      });
      setSubmitMode('ocr');
      setScanStatus('OCR complete. Review the extracted fields, then submit this machine-generated draft for approval.');
    } catch (error) {
      console.error(error);
      setScanStatus(`Scan failed. ${error.message}`);
    } finally {
      setIsScanning(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canUseIntake) return;

    try {
      const endpoint = submitMode === 'ocr' ? '/api/review-queue' : '/api/needs';
      const payload = {
        ...formValues,
        volunteersNeeded: Number(formValues.volunteersNeeded) || 1,
        source: submitMode === 'ocr' ? 'ocr' : 'dashboard',
        offlineCaptured: isOffline
      };
      const token = await getToken();

      if (isOffline) {
        queueOfflinePayload({ endpoint, payload });
        setOfflineQueueCount(readOfflineQueue().length);
        setSubmitted(true);
        setScanStatus('Device is offline. The intake draft has been safely queued and will sync automatically when connectivity returns.');
        setTimeout(() => {
          setSubmitted(false);
          setFormValues(initialFormState);
          setSelectedFileName('');
          setSubmitMode('manual');
        }, 3000);
        return;
      }

      await postJson(endpoint, payload, { token, timeoutMs: 20000 });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormValues(initialFormState);
        setSelectedFileName('');
        setSubmitMode('manual');
        setScanStatus('Upload a field report image to auto-fill the intake form.');
      }, 3000);
    } catch (err) {
      console.error(err);
      const endpoint = submitMode === 'ocr' ? '/api/review-queue' : '/api/needs';
      const payload = {
        ...formValues,
        volunteersNeeded: Number(formValues.volunteersNeeded) || 1,
        source: submitMode === 'ocr' ? 'ocr' : 'dashboard',
        offlineCaptured: true
      };
      queueOfflinePayload({ endpoint, payload });
      setOfflineQueueCount(readOfflineQueue().length);
      setScanStatus(`Submission moved to offline queue. ${err.message}`);
    }
  };

  const syncOfflineQueue = async () => {
    const queue = readOfflineQueue();
    if (!queue.length) {
      setOfflineQueueCount(0);
      return;
    }

    try {
      const token = await getToken();
      const remaining = [];

      for (const item of queue) {
        try {
          await postJson(item.endpoint, item.payload, { token, timeoutMs: 20000 });
        } catch {
          remaining.push(item);
        }
      }

      writeOfflineQueue(remaining);
      setOfflineQueueCount(remaining.length);
      if (!remaining.length) {
        setScanStatus('Offline field drafts synced successfully once connectivity returned.');
      }
    } catch (error) {
      console.error('Offline sync failed:', error);
    }
  };

  return (
    <div className="page-shell page-shell--form" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="text-gradient">Data Intake Portal</h1>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>Digitize paper surveys and field reports, or let Gemini OCR pre-fill the form from a photo.</p>
      </div>

      {!canUseIntake ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <ShieldAlert size={36} color="var(--accent-orange)" style={{ marginBottom: '1rem' }} />
          <h3>Intake Access Required</h3>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>
            {currentUser?.role === 'viewer'
              ? 'Viewers can inspect the platform but cannot create or scan new needs.'
              : 'Your current role does not have intake privileges.'}
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '3rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10%', left: '-5%', opacity: 0.05, transform: 'scale(1.5)', pointerEvents: 'none' }}>
            <FileText size={400} />
          </div>

          {submitted ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '1rem' }}>
              <CheckCircle size={64} color="var(--accent-green)" />
              <h2 style={{ color: 'var(--accent-green)' }}>{submitMode === 'ocr' ? 'Draft Submitted For Approval' : 'Data Successfully Logged'}</h2>
              <p className="text-muted">{submitMode === 'ocr' ? 'A coordinator can now review and approve this OCR-generated need from the approval queue.' : 'The system will now calculate volunteer matches.'}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
              <div className="glass-panel" style={{ padding: '1rem 1.1rem', borderRadius: '18px', background: isOffline ? 'rgba(255,149,0,0.08)' : 'rgba(0,255,136,0.06)', borderColor: isOffline ? 'rgba(255,149,0,0.25)' : 'rgba(0,255,136,0.18)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <WifiOff size={18} color={isOffline ? 'var(--accent-orange)' : 'var(--accent-green)'} />
                    <div>
                      <p style={{ fontWeight: 700 }}>{isOffline ? 'Offline field mode enabled' : 'Online sync active'}</p>
                      <p className="text-muted" style={{ fontSize: '0.84rem' }}>
                        {isOffline
                          ? 'New intake records will be stored locally and synced once the device reconnects.'
                          : 'Offline queue will auto-sync whenever drafts are waiting.'}
                      </p>
                    </div>
                  </div>
                  <div className="glass-panel" style={{ padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.025)' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Queued drafts</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{offlineQueueCount}</p>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '18px', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <ScanSearch size={20} color="var(--accent-cyan)" />
                      Paper-to-Digital Auto-Scanner
                    </h3>
                    <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.35rem' }}>{scanStatus}</p>
                    {selectedFileName ? <p style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', marginTop: '0.35rem' }}>Selected: {selectedFileName}</p> : null}
                  </div>

                  <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', cursor: isScanning ? 'wait' : 'pointer' }}>
                    <FileImage size={18} />
                    {isScanning ? 'Scanning...' : 'Upload Report Image'}
                    <input type="file" accept="image/*" onChange={handleOCRUpload} style={{ display: 'none' }} disabled={isScanning} />
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Record Title / Need</label>
                  <input name="title" required type="text" className="input-field" placeholder="e.g. Bulk water distribution needed" value={formValues.title} onChange={handleFieldChange} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Location / Address</label>
                  <input name="location" required type="text" className="input-field" placeholder="e.g. 1205 South St, District 4" value={formValues.location} onChange={handleFieldChange} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</label>
                  <select name="category" className="input-field" style={{ appearance: 'none' }} value={formValues.category} onChange={handleFieldChange}>
                    <option value="Medical">Medical / Health</option>
                    <option value="Logistics">Logistics / Sorting</option>
                    <option value="Education">Education / Tutoring</option>
                    <option value="Labor">Manual Labor</option>
                    <option value="Food">Food Distribution</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Urgency Level</label>
                  <select name="urgency" className="input-field" style={{ appearance: 'none' }} value={formValues.urgency} onChange={handleFieldChange}>
                    <option value="Low">Low - Within 14 days</option>
                    <option value="Medium">Medium - Within 7 days</option>
                    <option value="High">High - Within 48 hours</option>
                    <option value="Critical">Critical - Immediate</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Required Certification Badge</label>
                <input
                  name="requiredBadge"
                  type="text"
                  className="input-field"
                  value={formValues.requiredBadge}
                  onChange={handleFieldChange}
                  placeholder="Leave blank if no certification is required"
                />
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Medical, food, and child-support requests can now require a volunteer certification badge.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Detailed Field Notes (from paper report)</label>
                <textarea name="notes" required className="input-field" rows="4" placeholder="Enter findings from the field surveyor..." value={formValues.notes} onChange={handleFieldChange} />
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Volunteers Needed</label>
                  <input name="volunteersNeeded" required type="number" min="1" className="input-field" placeholder="Number of people required" value={formValues.volunteersNeeded} onChange={handleFieldChange} />
                </div>
                <div style={{ flex: 2, display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                  <button type="submit" className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}>
                    <Send size={18} />
                    {submitMode === 'ocr' ? 'Submit For Approval Queue' : 'Process & Submit into System'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

async function fileToUploadPayload(file) {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    const imageData = await svgFileToPngDataUrl(file);
    return {
      imageData,
      mimeType: 'image/png'
    };
  }

  const imageData = await fileToDataUrl(file);
  return {
    imageData,
    mimeType: file.type || 'image/png'
  };
}

async function svgFileToPngDataUrl(file) {
  const svgText = await file.text();
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.width || 1400;
    canvas.height = image.height || 1900;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas conversion is not available in this browser');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to convert SVG into a scan-ready image'));
    image.src = src;
  });
}

function readOfflineQueue() {
  try {
    return JSON.parse(window.localStorage.getItem(OFFLINE_INTAKE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue) {
  window.localStorage.setItem(OFFLINE_INTAKE_QUEUE_KEY, JSON.stringify(queue));
}

function queueOfflinePayload(item) {
  const queue = readOfflineQueue();
  queue.push({
    id: `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...item
  });
  writeOfflineQueue(queue);
}
