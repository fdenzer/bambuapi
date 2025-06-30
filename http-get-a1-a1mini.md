```yaml
openapi: 3.0.0
info:
  title: Bambu Lab Printer Task Status API (Conceptual)
  version: v1
  description: |-
    This document describes the API endpoint that appears to provide detailed
    print job status for Bambu Lab printers like the A1 mini.
    It is based on observed API logs.
    The GUI application currently shows N/A for many fields, suggesting it might
    not be using this endpoint or is misinterpreting data from another endpoint.

servers:
  - url: https://api.bambulab.com/v1
    description: Bambu Lab API Server

paths:
  /user-service/my/tasks:
    get:
      summary: Get Print Tasks for a Device
      description: |-
        Fetches a list of print tasks associated with a specific device.
        This endpoint provides detailed information about each print job,
        including its name, status, start time, and duration.
      operationId: getMyTasks
      parameters:
        - name: deviceId
          in: query
          required: true
          description: The ID of the device for which to fetch tasks.
          schema:
            type: string
            example: "0309DA3B2100793"
      responses:
        '200':
          description: Successful retrieval of print tasks.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskListResponse'
              example:
                total: 1
                hits:
                  - id: 394581792
                    designId: 1430646
                    designTitle: "Esquie Expedition 33 , multicolor by layer"
                    instanceId: 1505492
                    modelId: "US16b6067aee6a67"
                    title: "A1 Spinner 0.2mm nozzle, 0.06mm layer, 4 walls, 15% infill"
                    cover: "https://makerworld.bblmw.com/makerworld/cache/1/US16b6067aee6a67/308720741/3mf/1/REP1/Metadata/plate_1.png"
                    status: 4 # Note: Meaning of status codes needs to be defined. '4' might mean 'completed'.
                    feedbackStatus: 2
                    startTime: "2025-06-29T22:37:39Z"
                    endTime: "2025-06-29T22:38:07Z" # For an ongoing task, this might be null or a prediction.
                    weight: 4.83
                    length: 158
                    costTime: 7857 # In seconds. This could be 'Prediction (s)' or elapsed time.
                    profileId: 308720741
                    plateIndex: 1
                    plateName: "waaaaaaaaaaa"
                    deviceId: "0309DA3B2100793"
                    amsDetailMapping:
                      - ams: 0
                        sourceColor: "D6CCA3FF"
                        targetColor: "D6CCA3FF"
                        filamentId: ""
                        filamentType: "PETG"
                        targetFilamentType: ""
                        weight: 4.83
                        nozzleId: 0
                        amsId: 0
                        slotId: 0
                    mode: "cloud_slice"
                    isPublicProfile: true
                    isPrintable: true
                    isDelete: false
                    deviceModel: "A1 mini"
                    deviceName: "3DP-...-a1Mini"
                    bedType: "Textured PEI Plate"
                    jobType: 1
                    material:
                      id: ""
                      name: ""
                    platform: ""
                    stepSummary: []
                    nozzleInfos: []
        '400':
          description: Bad request (e.g., missing deviceId).
        '401':
          description: Unauthorized.
        '500':
          description: Internal server error.

components:
  schemas:
    TaskListResponse:
      type: object
      properties:
        total:
          type: integer
          format: int32
          description: Total number of tasks found.
          example: 1
        hits:
          type: array
          items:
            $ref: '#/components/schemas/Task'
          description: A list of tasks.

    Task:
      type: object
      properties:
        id:
          type: integer
          format: int64
          description: Unique ID of the task.
        designId:
          type: integer
          format: int64
          description: ID of the design.
        designTitle:
          type: string
          description: "Name of the print model/job. This should be used for 'Task Name'."
          example: "Esquie Expedition 33 , multicolor by layer"
        instanceId:
          type: integer
          format: int64
          description: ID of the print instance.
        modelId:
          type: string
          description: ID of the model.
        title:
          type: string
          description: Detailed title or profile name for the print.
        cover:
          type: string
          format: url
          description: URL to a cover image for the print.
        status:
          type: integer
          description: "Numerical code for print status. Needs mapping to human-readable text for 'Task Status'."
          example: 4
        feedbackStatus:
          type: integer
          description: Status related to user feedback.
        startTime:
          type: string
          format: date-time
          description: "The time the print task started. This is 'Start Time'."
          example: "2025-06-29T22:37:39Z"
        endTime:
          type: string
          format: date-time
          nullable: true
          description: "The time the print task ended. For an ongoing job, this might be null or a predicted end time."
          example: "2025-06-29T22:38:07Z"
        weight:
          type: number
          format: float
          description: Weight of the material used (e.g., in grams).
        length:
          type: integer
          description: Length of filament used (units might be mm).
        costTime:
          type: integer
          description: "Duration of the print in seconds. This is 'Prediction (s)' or elapsed time for an ongoing job."
          example: 7857
        profileId:
          type: integer
          format: int64
        plateIndex:
          type: integer
        plateName:
          type: string
        deviceId:
          type: string
          description: ID of the device associated with this task.
        amsDetailMapping:
          type: array
          items:
            $ref: '#/components/schemas/AmsDetail'
        mode:
          type: string
          example: "cloud_slice"
        isPublicProfile:
          type: boolean
        isPrintable:
          type: boolean
        isDelete:
          type: boolean
        deviceModel:
          type: string
          example: "A1 mini"
        deviceName:
          type: string
          example: "3DP-...-a1Mini"
        bedType:
          type: string
          example: "Textured PEI Plate"
        jobType:
          type: integer
        material:
          type: object
          properties:
            id:
              type: string
            name:
              type: string
        platform:
          type: string
        stepSummary:
          type: array
          items: {} # Define if structure is known
          description: Summary of steps, if applicable.
        nozzleInfos:
          type: array
          items: {} # Define if structure is known
          description: Information about nozzles used.
      required:
        - id
        - designTitle
        - status
        - startTime
        - costTime
        - deviceId

    AmsDetail:
      type: object
      properties:
        ams:
          type: integer
        sourceColor:
          type: string
          example: "D6CCA3FF"
        targetColor:
          type: string
          example: "D6CCA3FF"
        filamentId:
          type: string
        filamentType:
          type: string
          example: "PETG"
        targetFilamentType:
          type: string
        weight:
          type: number
          format: float
        nozzleId:
          type: integer
        amsId:
          type: integer
        slotId:
          type: integer
```
