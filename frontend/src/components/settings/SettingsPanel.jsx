import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Download, Upload, CloudUpload, CloudDownload } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useModelSettings } from '../../context/ModelSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFileTreeContext } from '../../context/FileTreeContext';
import * as billingService from '../../services/billingService';
import * as agentService from '../../services/agentService';
import { formatApiError } from '../../utils/apiError';
import { IconButton, Spinner } from '../ui/primitives';
import {
  exportSettings, importSettings, downloadSettingsJson,
} from '../../lib/settingsBackup';
import { pushSettingsToDrive, pullSettingsFromDrive } from '../../lib/settingsDriveSync';

const MODEL_PRESETS = {
  openrouter: [
    'openai/gpt-4o-mini',
    'deepseek/deepseek-chat',
    'meta-llama/llama-3.3-70b-instruct',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ],
  custom: [],
};

export default function SettingsPanel() {
  const theme = useTheme();
  const models = useModelSettings();
  const { user, refreshMe } = useAuth();
  const toast = useToast();
  const tree = useFileTreeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [form, setForm] = useState({
    provider: models.provider,
    apiKey: models.apiKey,
    model: models.model,
    baseUrl: models.baseUrl,
  });

  useEffect(() => {
    setForm({
      provider: models.provider,
      apiKey: models.apiKey,
      model: models.model,
      baseUrl: models.baseUrl,
    });
  }, [models.provider, models.apiKey, models.model, models.baseUrl]);

  const entitlements = user?.entitlements || null;
  const planName = entitlements?.planName || entitlements?.planId || user?.planId || 'free';
  const limits = entitlements?.limits || {};
  const features = entitlements?.features || {};
  const presets = MODEL_PRESETS[form.provider] || [];

  const saveModels = (e) => {
    e.preventDefault();
    models.save(form);
    toast.success('Model settings saved locally');
  };

  const clearKey = () => {
    models.clearKey();
    setForm((prev) => ({ ...prev, apiKey: '' }));
    toast.info('API key cleared');
  };

  const testConnection = async () => {
    if (!form.apiKey.trim()) {
      toast.error('Enter an API key first');
      return;
    }
    setProbing(true);
    try {
      const data = await agentService.probeLlm(form);
      toast.success(data?.sample ? `Connected — ${String(data.sample).slice(0, 40)}` : 'Connection OK');
    } catch (err) {
      toast.error(formatApiError(err, 'LLM probe failed'));
    } finally {
      setProbing(false);
    }
  };

  const refreshEntitlements = async () => {
    setRefreshing(true);
    try {
      const data = await billingService.getEntitlements();
      await refreshMe();
      toast.success(`Plan: ${data?.planName || data?.planId || planName}`);
    } catch (err) {
      try {
        await refreshMe();
        toast.info('Refreshed profile');
      } catch {
        toast.error(formatApiError(err, 'Could not refresh entitlements'));
      }
    } finally {
      setRefreshing(false);
    }
  };

  const upgrade = async (planId = 'pro') => {
    setUpgrading(true);
    try {
      const data = await billingService.startCheckout(planId);
      if (data?.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      await refreshMe();
      toast.success(data?.upgraded ? `Upgraded to ${data.planId || planId}` : 'Checkout started');
    } catch (err) {
      toast.error(formatApiError(err, 'Upgrade failed'));
    } finally {
      setUpgrading(false);
    }
  };

  const planId = String(entitlements?.planId || user?.planId || 'free').toLowerCase();
  const isFree = planId === 'free' || planId === 'oss' || !planId;

  return (
    <div className="settings-panel">
      <h3>Account</h3>
      <div className="settings-plan">
        <div className="settings-plan-head">
          <div>
            <span className="muted">Plan</span>
            <strong>{planName}</strong>
          </div>
          <IconButton title="Refresh entitlements" onClick={refreshEntitlements} disabled={refreshing}>
            {refreshing ? <Spinner size={12} /> : <RefreshCw size={13} />}
          </IconButton>
        </div>
        {isFree && (
          <button
            type="button"
            className="btn-primary settings-upgrade"
            disabled={upgrading}
            onClick={() => upgrade('pro')}
          >
            {upgrading ? <Spinner size={14} /> : <Sparkles size={14} />}
            Upgrade to Pro
          </button>
        )}
        <p className="settings-hint">
          Same IDE for everyone. Limits below are informational - configure BYOK for your own models.
        </p>
        <ul className="settings-limits">
          <li>
            Executions / min:
            {' '}
            {limits.maxExecutionsPerMinute ?? '-'}
          </li>
          <li>
            Agent pipelines / day:
            {' '}
            {limits.maxAgentPipelinesPerDay ?? '-'}
          </li>
          <li>
            Terminals:
            {' '}
            {limits.maxTerminals ?? '-'}
          </li>
          <li>
            Agents:
            {' '}
            {features.agents || limits.agentsEnabled ? 'on' : 'off'}
            {' | '}
            Debugger:
            {' '}
            {features.debugger || limits.debuggerEnabled ? 'on' : 'off'}
          </li>
        </ul>
      </div>

      <h3>Appearance</h3>
      <label className="field">
        Theme
        <select value={theme.theme} onChange={(e) => theme.setTheme(e.target.value)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>
      <label className="field">
        Editor font size
        <input
          type="number"
          min={12}
          max={28}
          value={theme.editorFontSize}
          onChange={(e) => theme.setEditorFontSize(Number(e.target.value) || 16)}
        />
      </label>
      <label className="field">
        Tab size
        <input
          type="number"
          min={1}
          max={8}
          value={theme.tabSize}
          onChange={(e) => theme.setTabSize(Math.min(8, Math.max(1, Number(e.target.value) || 2)))}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={theme.wordWrap}
          onChange={(e) => theme.setWordWrap(e.target.checked)}
        />
        Word wrap
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={theme.minimap}
          onChange={(e) => theme.setMinimap(e.target.checked)}
        />
        Minimap
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={theme.lineNumbers}
          onChange={(e) => theme.setLineNumbers(e.target.checked)}
        />
        Line numbers
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={theme.stickyScroll}
          onChange={(e) => theme.setStickyScroll(e.target.checked)}
        />
        Sticky scroll
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={theme.formatOnSave}
          onChange={(e) => theme.setFormatOnSave(e.target.checked)}
        />
        Format on save
      </label>

      <h3 style={{ marginTop: 8 }}>Your model (BYOK)</h3>
      <p className="settings-hint">
        Orion is free and open-source. Provide your own API key and model - keys stay in this browser.
      </p>
      <form onSubmit={saveModels} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="field">
          Provider
          <select
            value={form.provider}
            onChange={(e) => {
              const provider = e.target.value;
              const nextPreset = (MODEL_PRESETS[provider] || [])[0] || form.model;
              setForm({ ...form, provider, model: nextPreset });
            }}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="groq">Groq</option>
            <option value="custom">Custom base URL</option>
          </select>
        </label>
        {form.provider === 'custom' && (
          <label className="field">
            Base URL
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
            />
          </label>
        )}
        <label className="field">
          API key
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="sk-..."
            autoComplete="off"
          />
        </label>
        <label className="field">
          Model id
          <input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="openai/gpt-4o-mini"
            list="orion-model-presets"
          />
          {presets.length > 0 && (
            <datalist id="orion-model-presets">
              {presets.map((m) => <option key={m} value={m} />)}
            </datalist>
          )}
        </label>
        <div className="settings-byok-actions">
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" className="btn btn-ghost" disabled={probing || !form.apiKey} onClick={testConnection}>
            {probing ? <Spinner size={12} /> : null}
            Test connection
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearKey}>Clear key</button>
        </div>
      </form>

      <h3 style={{ marginTop: 16 }}>Backup</h3>
      <p className="settings-hint">
        Export theme, editor prefs, layout, and model settings (API key omitted unless you opt in).
      </p>
      <div className="settings-byok-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            downloadSettingsJson(exportSettings({ includeApiKey: false }));
            toast.success('Settings exported');
          }}
        >
          <Download size={14} />
          Export
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (!window.confirm('Include API key in the export file? Only do this on a trusted machine.')) {
              downloadSettingsJson(exportSettings({ includeApiKey: false }));
              return;
            }
            downloadSettingsJson(exportSettings({ includeApiKey: true }));
            toast.success('Settings exported (with key)');
          }}
        >
          Export + key
        </button>
        <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
          <Upload size={14} />
          Import
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const text = await file.text();
                importSettings(JSON.parse(text));
                toast.success('Imported — reloading…');
                setTimeout(() => window.location.reload(), 400);
              } catch (err) {
                toast.error(formatApiError(err, 'Import failed'));
              }
            }}
          />
        </label>
      </div>

      <h3 style={{ marginTop: 16 }}>Drive sync</h3>
      <p className="settings-hint">
        Save prefs to
        {' '}
        <code>.orion/settings.json</code>
        {' '}
        in this project (API key never uploaded).
      </p>
      <div className="settings-byok-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!tree?.projectId || driveSyncing}
          onClick={async () => {
            setDriveSyncing(true);
            try {
              await pushSettingsToDrive(tree.projectId);
              tree.refreshFolder?.(tree.projectId);
              toast.success('Pushed to Drive');
            } catch (err) {
              toast.error(formatApiError(err, 'Drive push failed'));
            } finally {
              setDriveSyncing(false);
            }
          }}
        >
          {driveSyncing ? <Spinner size={12} /> : <CloudUpload size={14} />}
          Push to Drive
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!tree?.projectId || driveSyncing}
          onClick={async () => {
            setDriveSyncing(true);
            try {
              const res = await pullSettingsFromDrive(tree.projectId);
              if (res.missing) {
                toast.info('No .orion/settings.json in this project yet');
                return;
              }
              toast.success('Pulled from Drive — reloading…');
              setTimeout(() => window.location.reload(), 400);
            } catch (err) {
              toast.error(formatApiError(err, 'Drive pull failed'));
            } finally {
              setDriveSyncing(false);
            }
          }}
        >
          {driveSyncing ? <Spinner size={12} /> : <CloudDownload size={14} />}
          Pull from Drive
        </button>
      </div>
    </div>
  );
}
