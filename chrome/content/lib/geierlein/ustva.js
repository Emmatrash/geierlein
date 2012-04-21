/**
 * UStVA (monthly value added tax declaration) module for Geierlein.
 *
 * @author Stefan Siegl
 *
 * Copyright (c) 2012 Stefan Siegl <stesie@brokenpipe.de>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function() {
var geierlein = {};
if(typeof(window) !== 'undefined') {
    geierlein = window.geierlein = window.geierlein || {};
}
else if(typeof(module) !== 'undefined' && module.exports) {
    geierlein = {
        Datenlieferant: require('./datenlieferant.js'),
        Steuerfall: require('./steuerfall.js'),
        util: require('./util.js')
    };
}

/**
 * Create new UStVA instance.
 * 
 * @param datenlieferant A Datenlieferant instance to use.
 * @param jahr The year of the declaration.
 * @param monat The month (1-12) or quarter specification (41-44) 
 */
geierlein.UStVA = function(datenlieferant, jahr, monat) {
    this.datenlieferant = datenlieferant || new geierlein.Datenlieferant();
    this.jahr = jahr;
    this.monat = monat;
};

geierlein.UStVA.prototype = new geierlein.Steuerfall();
geierlein.UStVA.prototype.constructor = geierlein.UStVA;


var taxNumberRules = [
    [5, 5],         // Baden Württemberg
    [3, 3, 5],      // Bayern
    [2, 3, 5],      // Berlin
    [3, 3, 5],      // Brandenburg
    [2, 3, 5],      // Bremen
    [2, 3, 5],      // Hamburg
    [3, 3, 5],      // Hessen
    [3, 3, 5],      // Mecklenburg-Vorpommern
    [2, 3, 5],      // Niedersachsen
    [3, 4, 4],      // Nordrhein-Westfalen
    [2, 3, 4, 1],   // Rheinland-Pfalz
    [3, 3, 5],      // Saarland
    [3, 3, 5],      // Sachsen
    [3, 3, 5],      // Sachsen-Anhalt
    [2, 3, 5],      // Schleswig-Holstein
    [3, 3, 5]       // Thüringen
];


function ruleRequired(val) {
    return val !== undefined;
}

function ruleRange(min, max) {
    return function(val) {
        if(val === undefined) {
            return true;  // ruleRange accepts undefined as valid!
        }

        val = parseInt(val, 10);
        return val >= min && val <= max;
    };
}

function ruleSignedInt(val) {
    return val === undefined || parseInt(val, 10) === +val;
}

function ruleUnsignedInt(val) {
    return val === undefined || (ruleSignedInt(val) && parseInt(val, 10) >= 0);
}

function ruleSignedMonetary(val) {
    return val === undefined || (+val == parseFloat(val).toFixed(2));
}

var validationRules = {
    land: [
        ruleRequired,
        ruleRange(1, 16)
    ],

    jahr: [
        ruleRequired,
        ruleRange(2010, 2012)
    ],

    monat: [
        ruleRequired,
        function(val) {
            return ruleRange(1, 12)(val) || ruleRange(41, 44)(val);
        }
    ],

    steuernummer: [],

    kz81: [ruleSignedInt],
    kz86: [ruleSignedInt],

    kz66: [ruleSignedMonetary],

    kz39: [ruleUnsignedInt],
    kz83: [ruleRequired, ruleSignedMonetary]
};

geierlein.util.extend(geierlein.UStVA.prototype, {
    datenart: 'UStVA',

    validate: function(field) {
        var errors = [];
        var ruleset = {};

        if(field === undefined) {
            ruleset = validationRules;
        } else {
            ruleset[field] = validationRules[field];
        }

        for(var fieldName in ruleset) {
            if(ruleset.hasOwnProperty(fieldName)) {
                var rule = ruleset[fieldName];
                for(var i = 0, max = rule.length; i < max; i ++) {
                    if(!rule[i](this[fieldName])) {
                        errors.push(fieldName);
                    }
                }
            }
        }

        return errors.length ? errors : true;
    },

    getTaxNumberSample: function() {
        /* Get rule according to choosen federal state (#land).  The options
         * in the frontend are indexed beginning from one, there subtract one */
        var rule = taxNumberRules[this.land - 1];
        var result = "";

        for(var i = 0; i < rule.length; i ++) {
            result += '/' + '12345'.substring(0, rule[i]);
        }

        return result.substring(1);
    },

    /**
     * Get Elster XML representation of the DatenTeil part.
     * 
     * @return XML representation of the DatenTeil part as a string.
     */
    getDatenteilXml: function() {
        var datenteil = new geierlein.util.Xml();

        datenteil.writeStartDocument();
        datenteil.writeStartElement('Nutzdatenblock');
            datenteil.writeStartElement('NutzdatenHeader');
            datenteil.writeAttributeString('version', 10);
                datenteil.writeElementString('NutzdatenTicket', '7805201');
                datenteil.writeStartElement('Empfaenger');
                datenteil.writeAttributeString('id', 'F');
                    datenteil.writeString('9203');
                datenteil.writeEndElement();
                datenteil.writeStartElement('Hersteller');
                    datenteil.writeElementString('ProduktName', 'Geierlein');
                    datenteil.writeElementString('ProduktVersion', '0.01');
                datenteil.writeEndElement();
                datenteil.writeElementString('DatenLieferant', 
                    this.datenlieferant.toString());
            datenteil.writeEndElement();    // NutzdatenHeader
        
            datenteil.writeStartElement('Nutzdaten');
                datenteil.writeStartElement('Anmeldungssteuern');
                datenteil.writeAttributeString('art', 'UStVA');
                datenteil.writeAttributeString('version', '201201');
        
                datenteil.writeElementString('DatenLieferant',
                    this.datenlieferant.toXml());
        
                datenteil.writeElementString('Erstellungsdatum', '20111120');
        
                datenteil.writeStartElement('Steuerfall');
                    datenteil.writeStartElement('Umsatzsteuervoranmeldung');
                        datenteil.writeElementString('Jahr', '2012');
                        datenteil.writeElementString('Zeitraum', '01');
                        datenteil.writeElementString('Steuernummer', '9203069802950');
                        datenteil.writeElementString('Kz09', '74931');
                        datenteil.writeElementString('Kz66', '90.00');
                        datenteil.writeElementString('Kz83', '100.00');
                        datenteil.writeElementString('Kz81', '1000');

        return datenteil.flush(true);
    }
});

if(typeof(module) !== 'undefined' && module.exports) {
    module.exports = geierlein.UStVA;
}

})();
