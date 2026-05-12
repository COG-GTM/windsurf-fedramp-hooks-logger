import React, { useEffect, useState } from 'react';
import { Cloud, Copy, Database, FolderOpen, Key, Layers, Settings, X } from 'lucide-react';
import { API_BASE } from '../constants';

function DirectoryPicker({ currentDir, onSelect, onClose }) {
  const [path, setPath] = useState(currentDir);
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Storage source selection state
  const [storageSource, setStorageSource] = useState('local'); // 'local', 's3', 'azure'
  const [s3Config, setS3Config] = useState({ bucket: '', prefix: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '' });
  const [azureConfig, setAzureConfig] = useState({ container: '', path: '', accountName: '', accountKey: '' });
  const [credentialMode, setCredentialMode] = useState('env'); // 'env' or 'manual'
  const [showEnvGuide, setShowEnvGuide] = useState(false);
  const [envInfo, setEnvInfo] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null); // 'success', 'error', or null
  const [copiedItem, setCopiedItem] = useState(null); // Track which item was copied for visual feedback

  // Fetch env file info on mount and when env guide opens
  useEffect(() => {
    fetch(`${API_BASE}/config/env-info`)
      .then(res => res.json())
      .then(data => setEnvInfo(data))
      .catch((err) => {
        console.error('Failed to fetch env info:', err);
        setEnvInfo({ env_path: 'Error loading path - check backend', error: true });
      });
  }, []);

  // Re-fetch env info when env guide modal opens
  useEffect(() => {
    if (showEnvGuide) {
      setEnvInfo(prev => prev?.error ? prev : null); // Reset to loading state unless error
      fetch(`${API_BASE}/config/env-info`)
        .then(res => res.json())
        .then(data => setEnvInfo(data))
        .catch((err) => {
          console.error('Failed to fetch env info:', err);
          setEnvInfo({ env_path: 'Error loading path - check backend', error: true });
        });
    }
  }, [showEnvGuide]);

  const fetchDirectories = async (dir) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/directories/browse?path=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.items) {
        setDirectories(data.items);
        setPath(data.current_path);
      }
    } catch (err) {
      console.error('Failed to browse directories:', err);
      setError('Failed to browse directory');
    } finally {
      setLoading(false);
    }
  };

  // Update path when currentDir prop changes (modal reopened)
  useEffect(() => {
    setPath(currentDir);
    fetchDirectories(currentDir);
  }, [currentDir]);

  const goUp = () => {
    const parent = path.split('/').slice(0, -1).join('/') || '/';
    fetchDirectories(parent);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="directory-picker-title"
    >
      <div className="bg-ws-card border border-ws-border rounded-lg shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col modal-bounce">
        <div className="flex items-center justify-between p-4 border-b border-ws-border">
          <h2 id="directory-picker-title" className="text-base font-semibold text-ws-text">Select Log Source</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-ws-card-hover rounded text-ws-text-muted hover:text-ws-text transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Storage Source Tabs */}
        <div className="flex border-b border-ws-border bg-ws-bg/30">
          {[
            { id: 'local', label: 'Local', icon: FolderOpen },
            { id: 's3', label: 'AWS S3', icon: Database },
            { id: 'azure', label: 'Azure', icon: Layers }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setStorageSource(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                storageSource === id
                  ? 'text-ws-teal border-b-2 border-ws-teal bg-ws-teal/5'
                  : 'text-ws-text-muted hover:text-ws-text hover:bg-ws-card-hover border-b-2 border-transparent'
              }`}
              aria-pressed={storageSource === id}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Local Directory Browser */}
        {storageSource === 'local' && (
          <>
            <div className="p-4 border-b border-ws-border">
              <div className="flex items-center gap-2">
                <label htmlFor="directory-path" className="sr-only">Directory path</label>
                <input
                  id="directory-path"
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchDirectories(path)}
                  className="flex-1 px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
                />
                <button
                  onClick={() => fetchDirectories(path)}
                  className="px-3 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
                >
                  Go
                </button>
              </div>
            </div>
          </>
        )}

        {/* S3 Configuration */}
        {storageSource === 's3' && (
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            <p className="text-xs text-ws-text-muted">
              Connect to an S3 bucket containing your hooks logs.
            </p>
            
            {/* Credential Mode Toggle */}
            <div className="flex gap-2 p-1 bg-ws-bg rounded border border-ws-border">
              <button
                onClick={() => setCredentialMode('env')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  credentialMode === 'env'
                    ? 'bg-ws-teal text-white'
                    : 'text-ws-text-muted hover:text-ws-text'
                }`}
              >
                🔒 Use .env (Recommended)
              </button>
              <button
                onClick={() => setCredentialMode('manual')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  credentialMode === 'manual'
                    ? 'bg-ws-orange text-white'
                    : 'text-ws-text-muted hover:text-ws-text'
                }`}
              >
                ⚠️ Enter Manually
              </button>
            </div>

            <div>
              <label htmlFor="s3-bucket" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Bucket Name *
              </label>
              <input
                id="s3-bucket"
                type="text"
                value={s3Config.bucket}
                onChange={(e) => setS3Config({ ...s3Config, bucket: e.target.value })}
                placeholder="my-logs-bucket"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>
            <div>
              <label htmlFor="s3-prefix" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Prefix / Path
              </label>
              <input
                id="s3-prefix"
                type="text"
                value={s3Config.prefix}
                onChange={(e) => setS3Config({ ...s3Config, prefix: e.target.value })}
                placeholder="logs/windsurf/"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>
            <div>
              <label htmlFor="s3-region" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Region
              </label>
              <select
                id="s3-region"
                value={s3Config.region}
                onChange={(e) => setS3Config({ ...s3Config, region: e.target.value })}
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-east-2">US East (Ohio)</option>
                <option value="us-west-1">US West (N. California)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="us-gov-west-1">AWS GovCloud (US-West)</option>
                <option value="us-gov-east-1">AWS GovCloud (US-East)</option>
                <option value="eu-west-1">EU (Ireland)</option>
                <option value="eu-west-2">EU (London)</option>
                <option value="eu-central-1">EU (Frankfurt)</option>
              </select>
            </div>

            {/* Manual Credential Entry */}
            {credentialMode === 'manual' && (
              <>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 text-base">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-400 mb-1">Security Warning</p>
                      <p className="text-red-300/80">
                        Entering credentials here is less secure. They may be visible in browser memory/dev tools. 
                        For production use, configure via .env file instead.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="s3-access-key" className="block text-xs font-medium text-ws-text-secondary mb-1">
                    Access Key ID
                  </label>
                  <input
                    id="s3-access-key"
                    type="text"
                    value={s3Config.accessKeyId}
                    onChange={(e) => setS3Config({ ...s3Config, accessKeyId: e.target.value })}
                    placeholder="AKIA..."
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal font-mono"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="s3-secret-key" className="block text-xs font-medium text-ws-text-secondary mb-1">
                    Secret Access Key
                  </label>
                  <input
                    id="s3-secret-key"
                    type="password"
                    value={s3Config.secretAccessKey}
                    onChange={(e) => setS3Config({ ...s3Config, secretAccessKey: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal font-mono"
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {/* Env Configuration Guide */}
            {credentialMode === 'env' && (
              <div className="bg-ws-teal/10 border border-ws-teal/30 rounded p-3 space-y-2">
                <p className="text-xs text-ws-teal font-medium">✓ Secure: Credentials stored in .env file</p>
                <button
                  onClick={() => setShowEnvGuide(true)}
                  className="w-full px-3 py-2 bg-ws-teal/20 hover:bg-ws-teal/30 border border-ws-teal/30 rounded text-xs text-ws-teal font-medium transition-colors"
                >
                  📝 Configure .env File (Step-by-Step Guide)
                </button>
                {envInfo?.has_env_credentials?.aws && (
                  <p className="text-xs text-green-400">✓ AWS credentials detected in .env</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Azure Configuration */}
        {storageSource === 'azure' && (
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            <p className="text-xs text-ws-text-muted">
              Connect to an Azure Blob container containing your hooks logs.
            </p>
            
            {/* Credential Mode Toggle */}
            <div className="flex gap-2 p-1 bg-ws-bg rounded border border-ws-border">
              <button
                onClick={() => setCredentialMode('env')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  credentialMode === 'env'
                    ? 'bg-ws-teal text-white'
                    : 'text-ws-text-muted hover:text-ws-text'
                }`}
              >
                🔒 Use .env (Recommended)
              </button>
              <button
                onClick={() => setCredentialMode('manual')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  credentialMode === 'manual'
                    ? 'bg-ws-orange text-white'
                    : 'text-ws-text-muted hover:text-ws-text'
                }`}
              >
                ⚠️ Enter Manually
              </button>
            </div>

            <div>
              <label htmlFor="azure-account" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Storage Account Name *
              </label>
              <input
                id="azure-account"
                type="text"
                value={azureConfig.accountName}
                onChange={(e) => setAzureConfig({ ...azureConfig, accountName: e.target.value })}
                placeholder="mystorageaccount"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>
            <div>
              <label htmlFor="azure-container" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Container Name *
              </label>
              <input
                id="azure-container"
                type="text"
                value={azureConfig.container}
                onChange={(e) => setAzureConfig({ ...azureConfig, container: e.target.value })}
                placeholder="logs-container"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>
            <div>
              <label htmlFor="azure-path" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Blob Path / Prefix
              </label>
              <input
                id="azure-path"
                type="text"
                value={azureConfig.path}
                onChange={(e) => setAzureConfig({ ...azureConfig, path: e.target.value })}
                placeholder="windsurf/hooks/"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>

            {/* Manual Credential Entry */}
            {credentialMode === 'manual' && (
              <>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 text-base">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-400 mb-1">Security Warning</p>
                      <p className="text-red-300/80">
                        Entering credentials here is less secure. They may be visible in browser memory/dev tools. 
                        For production use, configure via .env file instead.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="azure-key" className="block text-xs font-medium text-ws-text-secondary mb-1">
                    Storage Account Key
                  </label>
                  <input
                    id="azure-key"
                    type="password"
                    value={azureConfig.accountKey}
                    onChange={(e) => setAzureConfig({ ...azureConfig, accountKey: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal font-mono"
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {/* Env Configuration Guide */}
            {credentialMode === 'env' && (
              <div className="bg-ws-teal/10 border border-ws-teal/30 rounded p-3 space-y-2">
                <p className="text-xs text-ws-teal font-medium">✓ Secure: Credentials stored in .env file</p>
                <button
                  onClick={() => setShowEnvGuide(true)}
                  className="w-full px-3 py-2 bg-ws-teal/20 hover:bg-ws-teal/30 border border-ws-teal/30 rounded text-xs text-ws-teal font-medium transition-colors"
                >
                  📝 Configure .env File (Step-by-Step Guide)
                </button>
                {envInfo?.has_env_credentials?.azure && (
                  <p className="text-xs text-green-400">✓ Azure credentials detected in .env</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Local Directory Browser */}
        {storageSource === 'local' && (
          <div className="flex-1 overflow-auto p-2">
            <button
              onClick={goUp}
              className="w-full flex items-center gap-2 p-2 rounded hover:bg-ws-card-hover text-ws-text-secondary text-sm transition-colors"
              aria-label="Navigate to parent directory"
            >
              <FolderOpen className="w-4 h-4 text-ws-text-muted" aria-hidden="true" />
              <span>..</span>
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="rounded-full h-5 w-5 border-2 border-ws-teal border-t-transparent spinner-smooth"></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-red-400 text-sm mb-2">{error}</p>
                <button
                  onClick={() => fetchDirectories(path)}
                  className="text-xs text-ws-teal hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : directories.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-ws-text-muted text-sm">No subdirectories found</p>
              </div>
            ) : (
              directories.map(dir => (
                <button
                  key={dir.path}
                  onClick={() => fetchDirectories(dir.path)}
                  className={`w-full flex items-center gap-2 p-2 rounded hover:bg-ws-card-hover text-ws-text-secondary text-sm transition-colors ${
                    dir.has_logs ? 'border border-ws-teal/30' : ''
                  }`}
                  aria-label={`Open directory ${dir.name}${dir.has_logs ? ', contains log files' : ''}`}
                >
                  <FolderOpen className={`w-4 h-4 ${dir.has_logs ? 'text-ws-teal' : 'text-ws-text-muted'}`} aria-hidden="true" />
                  <span className="flex-1 text-left" style={{wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.2'}}>{dir.name}</span>
                  {dir.has_logs && (
                    <span className="text-xs text-ws-teal">Has logs</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* Cloud storage connection status */}
        {storageSource !== 'local' && connectionStatus && (
          <div className={`mx-4 mb-2 p-3 rounded-lg flex items-center gap-3 ${
            connectionStatus === 'success' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {connectionStatus === 'success' ? (
              <><span className="text-green-400">✓</span><span className="text-green-400 text-sm">Connected successfully</span></>
            ) : (
              <><span className="text-red-400">✗</span><span className="text-red-400 text-sm">Connection failed - check credentials</span></>
            )}
          </div>
        )}

        <div className="p-4 border-t border-ws-border flex justify-between gap-2">
          <button
            onClick={() => {
              // Test connection
              setTestingConnection(true);
              setConnectionStatus(null);
              const config = storageSource === 's3' ? {
                type: 's3',
                bucket: s3Config.bucket,
                prefix: s3Config.prefix,
                region: s3Config.region,
                ...(credentialMode === 'manual' && s3Config.accessKeyId && {
                  access_key_id: s3Config.accessKeyId,
                  secret_access_key: s3Config.secretAccessKey
                })
              } : {
                type: 'azure',
                account_name: azureConfig.accountName,
                container: azureConfig.container,
                path: azureConfig.path,
                ...(credentialMode === 'manual' && azureConfig.accountKey && {
                  account_key: azureConfig.accountKey
                })
              };
              
              fetch(`${API_BASE}/storage/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
              })
                .then(res => res.json())
                .then(data => {
                  setConnectionStatus(data.success ? 'success' : 'error');
                })
                .catch(() => setConnectionStatus('error'))
                .finally(() => setTestingConnection(false));
            }}
            disabled={
              storageSource === 'local' ||
              testingConnection ||
              (storageSource === 's3' && !s3Config.bucket) ||
              (storageSource === 'azure' && (!azureConfig.accountName || !azureConfig.container))
            }
            className={`px-4 py-2 border rounded text-sm transition-colors ${
              storageSource === 'local' ? 'hidden' : ''
            } ${
              testingConnection 
                ? 'border-ws-border text-ws-text-muted cursor-wait' 
                : 'border-ws-teal text-ws-teal hover:bg-ws-teal/10'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-ws-text-muted hover:text-ws-text text-sm transition-colors"
            >
              Cancel
            </button>
            {storageSource === 'local' ? (
              <button
                onClick={() => onSelect(path)}
                className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
              >
                Select Directory
              </button>
            ) : (
              <button
                onClick={async () => {
                  const config = storageSource === 's3' ? {
                    type: 's3',
                    bucket: s3Config.bucket,
                    prefix: s3Config.prefix,
                    region: s3Config.region,
                    ...(credentialMode === 'manual' && s3Config.accessKeyId && {
                      access_key_id: s3Config.accessKeyId,
                      secret_access_key: s3Config.secretAccessKey
                    })
                  } : {
                    type: 'azure',
                    account_name: azureConfig.accountName,
                    container: azureConfig.container,
                    path: azureConfig.path,
                    ...(credentialMode === 'manual' && azureConfig.accountKey && {
                      account_key: azureConfig.accountKey
                    })
                  };
                  
                  try {
                    const res = await fetch(`${API_BASE}/storage/configure`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(config)
                    });
                    const data = await res.json();
                    if (data.success) {
                      // Pass the storage URI to parent
                      const storageUri = storageSource === 's3' 
                        ? `s3://${s3Config.bucket}/${s3Config.prefix || ''}` 
                        : `azure://${azureConfig.accountName}/${azureConfig.container}/${azureConfig.path || ''}`;
                      onSelect(storageUri);
                    } else {
                      alert(`Failed to configure storage: ${data.error || 'Unknown error'}`);
                    }
                  } catch (err) {
                    alert('Failed to configure storage. Please check your settings.');
                  }
                }}
                disabled={
                  (storageSource === 's3' && !s3Config.bucket) ||
                  (storageSource === 'azure' && (!azureConfig.accountName || !azureConfig.container))
                }
                className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect & Use Storage
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Environment Configuration Guide Modal */}
      {showEnvGuide && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="bg-ws-card border border-ws-border rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-ws-border">
              <h3 className="text-base font-semibold text-ws-text">📝 Configure Credentials via .env File</h3>
              <button
                onClick={() => setShowEnvGuide(false)}
                className="p-1 hover:bg-ws-card-hover rounded text-ws-text-muted hover:text-ws-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Step 1 */}
              <div className="bg-ws-bg/50 rounded-lg p-4 border border-ws-border">
                <h4 className="text-sm font-semibold text-ws-teal mb-2">Step 1: Locate your .env file</h4>
                <p className="text-xs text-ws-text-secondary mb-3">
                  The .env file should be in your windsurf-logger root directory:
                </p>
                <div className={`bg-ws-bg rounded p-2 font-mono text-xs flex items-center justify-between gap-2 ${
                  envInfo?.error ? 'text-red-400 border border-red-500/30' : 'text-ws-text'
                }`}>
                  <span className="break-all flex-1">
                    {envInfo === null ? (
                      <span className="text-ws-text-muted">Loading path...</span>
                    ) : envInfo?.error ? (
                      <span>⚠️ {envInfo.env_path}</span>
                    ) : (
                      envInfo.env_path
                    )}
                  </span>
                  <button
                    onClick={() => {
                      const pathToCopy = envInfo?.env_path;
                      if (pathToCopy && !envInfo?.error) {
                        navigator.clipboard.writeText(pathToCopy);
                        setCopiedItem('env-path');
                        setTimeout(() => setCopiedItem(null), 2000);
                      }
                    }}
                    disabled={!envInfo || envInfo?.error}
                    className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-all ${
                      copiedItem === 'env-path' 
                        ? 'bg-green-500/20 text-green-400' 
                        : envInfo?.error
                          ? 'text-ws-text-muted cursor-not-allowed opacity-50'
                          : 'text-ws-teal hover:bg-ws-teal/10'
                    }`}
                  >
                    {copiedItem === 'env-path' ? '✓ Copied!' : '📋 Copy Path'}
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/config/reveal-env`, { method: 'POST' });
                        const data = await res.json();
                        if (!data.success) {
                          alert(data.message || 'Could not open file location');
                        }
                      } catch (err) {
                        alert(`Network error: ${err.message}. Make sure the backend is running.`);
                      }
                    }}
                    className="px-3 py-1.5 bg-ws-teal/20 hover:bg-ws-teal/30 text-ws-teal rounded text-xs font-medium transition-colors"
                  >
                    📂 Open in Finder
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/config/open-env`, { method: 'POST' });
                        const data = await res.json();
                        if (!data.success) {
                          alert(data.message || 'Could not open file');
                        }
                      } catch (err) {
                        alert(`Network error: ${err.message}. Make sure the backend is running.`);
                      }
                    }}
                    className="px-3 py-1.5 bg-ws-teal/20 hover:bg-ws-teal/30 text-ws-teal rounded text-xs font-medium transition-colors"
                  >
                    📝 Open in Editor
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-ws-bg/50 rounded-lg p-4 border border-ws-border">
                <h4 className="text-sm font-semibold text-ws-teal mb-2">Step 2: Add your credentials</h4>
                <p className="text-xs text-ws-text-secondary mb-3">
                  Copy and paste the following into your .env file, replacing the placeholder values:
                </p>
                
                {storageSource === 's3' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-ws-text-muted">For AWS S3:</p>
                    <pre className="bg-ws-bg rounded p-3 text-xs text-ws-text font-mono overflow-x-auto whitespace-pre">
{`# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_DEFAULT_REGION=${s3Config.region || 'us-east-1'}

# S3 Bucket Settings (optional - can also set in UI)
WINDSURF_S3_BUCKET=${s3Config.bucket || 'your-bucket-name'}
WINDSURF_S3_PREFIX=${s3Config.prefix || 'logs/'}`}
                    </pre>
                    <button
                      onClick={() => {
                        const text = `# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_DEFAULT_REGION=${s3Config.region || 'us-east-1'}

# S3 Bucket Settings (optional - can also set in UI)
WINDSURF_S3_BUCKET=${s3Config.bucket || 'your-bucket-name'}
WINDSURF_S3_PREFIX=${s3Config.prefix || 'logs/'}`;
                        navigator.clipboard.writeText(text);
                        setCopiedItem('s3-config');
                        setTimeout(() => setCopiedItem(null), 2000);
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                        copiedItem === 's3-config'
                          ? 'bg-green-500 text-white'
                          : 'bg-ws-teal text-white hover:bg-ws-teal-dim'
                      }`}
                    >
                      {copiedItem === 's3-config' ? '✓ Copied!' : '📋 Copy to Clipboard'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-ws-text-muted">For Azure Blob Storage:</p>
                    <pre className="bg-ws-bg rounded p-3 text-xs text-ws-text font-mono overflow-x-auto whitespace-pre">
{`# Azure Blob Storage Configuration
AZURE_STORAGE_ACCOUNT_NAME=${azureConfig.accountName || 'your_account_name'}
AZURE_STORAGE_ACCOUNT_KEY=your_account_key_here

# Azure Container Settings (optional - can also set in UI)
WINDSURF_AZURE_CONTAINER=${azureConfig.container || 'your-container'}
WINDSURF_AZURE_PATH=${azureConfig.path || 'logs/'}`}
                    </pre>
                    <button
                      onClick={() => {
                        const text = `# Azure Blob Storage Configuration
AZURE_STORAGE_ACCOUNT_NAME=${azureConfig.accountName || 'your_account_name'}
AZURE_STORAGE_ACCOUNT_KEY=your_account_key_here

# Azure Container Settings (optional - can also set in UI)
WINDSURF_AZURE_CONTAINER=${azureConfig.container || 'your-container'}
WINDSURF_AZURE_PATH=${azureConfig.path || 'logs/'}`;
                        navigator.clipboard.writeText(text);
                        setCopiedItem('azure-config');
                        setTimeout(() => setCopiedItem(null), 2000);
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                        copiedItem === 'azure-config'
                          ? 'bg-green-500 text-white'
                          : 'bg-ws-teal text-white hover:bg-ws-teal-dim'
                      }`}
                    >
                      {copiedItem === 'azure-config' ? '✓ Copied!' : '📋 Copy to Clipboard'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 3 */}
              <div className="bg-ws-bg/50 rounded-lg p-4 border border-ws-border">
                <h4 className="text-sm font-semibold text-ws-teal mb-2">Step 3: Restart the backend</h4>
                <p className="text-xs text-ws-text-secondary">
                  After saving your .env file, restart the dashboard backend for changes to take effect:
                </p>
                <pre className="bg-ws-bg rounded p-2 mt-2 text-xs text-ws-text font-mono">
                  cd windsurf-logger && ./dashboard/start.sh
                </pre>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/config/restart-backend`, { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          alert('Backend restart initiated. The page will reload in 3 seconds...');
                          setTimeout(() => window.location.reload(), 3000);
                        } else {
                          alert(data.message || 'Could not restart backend');
                        }
                      } catch (err) {
                        alert(`Network error: ${err.message}. You may need to restart manually.`);
                      }
                    }}
                    className="px-3 py-1.5 bg-ws-orange/20 hover:bg-ws-orange/30 text-ws-orange rounded text-xs font-medium transition-colors"
                  >
                    🔄 Restart Backend
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('cd windsurf-logger && ./dashboard/start.sh');
                      setCopiedItem('restart-cmd');
                      setTimeout(() => setCopiedItem(null), 2000);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      copiedItem === 'restart-cmd'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-ws-teal/20 hover:bg-ws-teal/30 text-ws-teal'
                    }`}
                  >
                    {copiedItem === 'restart-cmd' ? '✓ Copied!' : '📋 Copy Command'}
                  </button>
                </div>
              </div>

              {/* Security Note */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-400 mb-2">✓ Why this is more secure</h4>
                <ul className="text-xs text-green-300/80 space-y-1 list-disc list-inside">
                  <li>Credentials are never sent to the browser</li>
                  <li>The .env file is excluded from git (check your .gitignore)</li>
                  <li>Credentials are only loaded server-side</li>
                  <li>Works with IAM roles in cloud environments</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-ws-border flex justify-end">
              <button
                onClick={() => {
                  setShowEnvGuide(false);
                  // Refresh env info
                  fetch(`${API_BASE}/config/env-info`)
                    .then(res => res.json())
                    .then(data => setEnvInfo(data))
                    .catch(() => {});
                }}
                className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DirectoryPicker;
export { DirectoryPicker };
