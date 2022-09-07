// Code based on https://github.com/StephanJoubert/home_assistant_solarman
// From sensor.py

//////////////////////////////////////////////////////////////////////////////
//   Solarman local interface.
//
//   This component can retrieve data from the solarman dongle using version 5
//   of the protocol.
//
//////////////////////////////////////////////////////////////////////////////
const inverter = require('./inverter');

class Sensor
{
    constructor(inverter_sn, inverter_host, inverter_port, inverter_mb_slaveid, lookup_file)
    {
        this.inverter_name = 'Adrian';
        this.inverter_sn = inverter_sn;
        this.inverter = new inverter(inverter_sn, inverter_host, inverter_port, inverter_mb_slaveid, lookup_file);
        this.getSensors();
    }

    setHost(inverter_host)
    {
        this.inverter.setHost(inverter_host);
    }

    async getSensors()
    {
        //  Prepare the sensor entities.
        let sensors = [];
        for (var sensor of this.inverter.get_sensors())
        {
            if (sensor.isstr)
            {
                sensors = sensors.concat(new SolarmanSensorText(this.inverter_name, this.inverter, sensor, this.inverter_sn));
            }
            else
            {
                sensors = sensors.concat(new SolarmanSensor(this.inverter_name, this.inverter, sensor, this.inverter_sn));
            }
        }

        sensors = sensors.concat(new SolarmanStatus(this.inverter_name, this.inverter, "status_lastUpdate", this.inverter_sn));
        sensors = sensors.concat(new SolarmanStatus(this.inverter_name, this.inverter, "status_connection", this.inverter_sn));

        console.log(sensors);
        return sensors;
    }

    async getStatistics()
    {
        return await this.inverter.get_statistics();
    }

    getSerial()
    {
        return this.inverter_sn;
    }
}

module.exports = Sensor;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// This is the entity seen by Home Assistant.
//  It derives from the Entity class in HA and is suited for status values.
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class SolarmanStatus
{
    constructor(inverter_name, inverter, field_name, sn)
    {
        this._inverter_name = inverter_name;
        this.inverter = inverter;
        this._field_name = field_name;
        this.p_state = null;
        this.p_icon = 'mdi:magnify';
        this._sn = sn;
        return;
    }

    //@property
    get icon()
    {
        //  Return the icon of the sensor. """
        return this.p_icon;
    }

    //@property
    get name()
    {
        //  Return the name of the sensor.
        return "{} {}".format(this._inverter_name, this._field_name);
    }

    // @property
    get unique_id()
    {
        // Return a unique_id based on the serial number
        return "{}_{}_{}".format(this._inverter_name, this._sn, this._field_name);
    }

    //@property
    get state()
    {
        //  Return the state of the sensor.
        return this.p_state;
    }

    update()
    {
        this.p_state = getattr(this.inverter, this._field_name);
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //  Entity displaying a text field read from the inverter
    //   Overrides the Status entity, supply the configured icon, and updates the inverter parameters
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
}


class SolarmanSensorText extends SolarmanStatus
{
    constructor(inverter_name, inverter, sensor, sn)
    {
        super(inverter_name, inverter, sensor.name, sn);

        if (sensor.icon)
        {
            this.p_icon = sensor.icon;
        }
        else
        {
            this.p_icon = '';
        }
        return;
    }

    update()
    {
        //  Update this sensor using the data.
        //  Get the latest data and use it to update our sensor state.
        //  Retrieve the sensor data from actual interface
        this.inverter.update();

        val = this.inverter.get_current_val();
        if (val !== null)
        {
            if (this._field_name in val)
            {
                this.p_state = val[this._field_name];
            }
        }
    }
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  Entity displaying a numeric field read from the inverter
//   Overrides the Text sensor and supply the device class, last_reset and unit of measurement
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class SolarmanSensor extends SolarmanSensorText
{
    constructor(inverter_name, inverter, sensor, sn)
    {
        super(inverter_name, inverter, sensor, sn);

        this._device_class = sensor.class;

        if ('state_class' in sensor)
        {
            this._state_class = sensor.state_class;
        }
        else
        {
            this._state_class = null;
        }
        this.uom = sensor.uom;
        return;
    }

    //@property
    get device_class()
    {
        return this._device_class;
    }

    //@property
    get extra_state_attributes()
    {
        if (this._state_class)
        {
            return { state_class: this._state_class };
        }
        else
        {
            return null;
        }
    }

    //@property
    unit_of_measurement()
    {
        return this.uom;
    }
}