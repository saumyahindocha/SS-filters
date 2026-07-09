"""Sample MQTT publisher for real PLC/IoT gateways.

Publishes a realistic JSON telemetry payload per tower to:
    factory/towers/<tower_id>/telemetry
matching the wildcard the ingestion service subscribes to.

Use this as a template for the on-prem gateway that bridges Modbus RTU -> MQTT.
"""
import json
import math
import os
import random
import time
import paho.mqtt.client as mqtt

HOST = os.environ.get("MQTT_HOST", "localhost")
PORT = int(os.environ.get("MQTT_PORT", "1883"))
N = int(os.environ.get("NUM_TOWERS", "2"))
INTERVAL = float(os.environ.get("PUBLISH_INTERVAL_SEC", "15"))


def sample(step, i):
    fouling = min(0.9, 0.1 + 0.05 * i + 0.0002 * step)
    ambient = 32 + 3 * math.sin(step / 240) + random.uniform(-0.3, 0.3)
    wet_bulb = ambient - 5.5
    load = 0.7 + 0.25 * math.sin(step / 120 + i)
    flow = 520 * (0.85 + 0.15 * load) - fouling * 20
    supply = wet_bulb + 4.0
    delta_t = 5.5 * (1 - 0.35 * fouling)
    ret = supply + delta_t
    return {
        "tower_id": f"CT-{i+1:02d}",
        "flow_m3h": round(flow, 2),
        "supply_temp_c": round(supply, 2),
        "return_temp_c": round(ret, 2),
        "ambient_temp_c": round(ambient, 2),
        "wet_bulb_c": round(wet_bulb, 2),
        "pressure_in_kpa": round(320 + random.uniform(-4, 4), 2),
        "pressure_out_kpa": round(280 - fouling * 25, 2),
        "filter_dp_kpa": round(6 + 30 * fouling, 2),
        "conductivity_us": round(900 + 1400 * fouling, 1),
        "turbidity_ntu": round(1.5 + 12 * fouling, 2),
        "ph": round(7.6 - 0.6 * fouling, 2),
        "humidity_rh": round(55 + 15 * math.sin(step / 300), 1),
        "fan_kw": round(22 * load * (1 + 0.25 * fouling), 2),
        "pump_kw": round(30 * load * (1 + 0.15 * fouling), 2),
        "chiller_kw": round(210 * load * (1 + 0.12 * fouling), 2),
    }


def main():
    client = mqtt.Client()
    client.connect(HOST, PORT, 60)
    client.loop_start()
    step = 0
    while True:
        step += 1
        for i in range(N):
            payload = sample(step, i)
            topic = f"factory/towers/{payload['tower_id']}/telemetry"
            client.publish(topic, json.dumps(payload), qos=0)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
