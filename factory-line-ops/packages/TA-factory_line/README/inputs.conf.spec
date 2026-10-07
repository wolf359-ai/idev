# Documented for operators. Do not put real tokens in default/inputs.conf.
# This TA does not ship an enabled HEC input (Cloud manages HEC; lab tokens
# are created in Splunk Web and stored on the instance only).

[http://factory_line_ops]
token = <value>
* HEC token. Set only via Splunk Web, REST, or local/inputs.conf.
* Never commit this value. Never put it in default/.
index = <value>
indexes = <comma-separated>
sourcetype = <value>
useACK = <0|1>
