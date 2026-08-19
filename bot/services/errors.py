class PilotApiError(RuntimeError):
    def __init__(self, code: str, status: int = 500):
        super().__init__(code)
        self.code = code
        self.status = status
