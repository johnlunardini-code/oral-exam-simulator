// Windows voice mappings - exact names from Windows Narrator settings
const VOICE_MAP = {
    'Microsoft Sonia': 'Microsoft Sonia - English (United Kingdom)',
    'Microsoft David': 'Microsoft David - English (United States)',
    'Microsoft Zira': 'Microsoft Zira - English (United States)',
    'Microsoft Mark': 'Microsoft Mark - English (United States)',
    'Google US English': 'Google US English',
    'Google UK English': 'Google UK English'
};

function getActualVoiceName(preferredName) {
    return VOICE_MAP[preferredName] || preferredName;
}
