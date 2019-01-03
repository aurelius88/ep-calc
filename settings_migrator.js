"use strict";

const DefaultSettings = {
    defaultLanguage: "en",
    languages: {
        en: "English",
        de: "German",
        fr: "French"
    },
    tracking: false,
    verbose: false
};

// from_ver, to_ver = version number; settings = "old settings"
module.exports = function MigrateSettings( from_ver, to_ver, settings ) {
    if ( from_ver === undefined ) {
        // Migrate legacy config file
        return Object.assign( Object.assign({}, DefaultSettings ), settings );
    } else if ( from_ver === null ) {
        // No config file exists or corrupted file, use default settings
        return DefaultSettings;
    } else {
        // Migrate from older version (using the new system) to latest one
        let migratedSettings = null;
        switch ( from_ver ) {
            case 1:
                migratedSettings = Object.assign( settings, { tracking: false, verbose: false });
                break;
            default:
                throw new Error( "There is no other version migration." );
        }
        return migratedSettings;
    }
};
