; Edge case test: feed rate below recommended minimum, excessive depth, unmatched tool

G90 G94 G17

(Tool: Amana 46202-K)
T1 M6
S18000 M3
G0 X0 Y0 Z1.0
G1 Z-0.5 F90
G1 X10 Y0 F90
G0 Z1.0

(Tool: Unknown Brand XYZ-123)
T5 M6
S5000 M3
G0 X0 Y0 Z0.5
G1 Z-0.1 F200
G1 X5 Y0 F200
G0 Z0.5

M5
M30