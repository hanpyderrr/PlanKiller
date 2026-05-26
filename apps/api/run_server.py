import logging
import os
import sys

# 当 PyInstaller 以 --onefile 打包时，临时解压目录会加入 sys.path
if getattr(sys, "frozen", False):
    sys.path.insert(0, sys._MEIPASS)  # noqa: SLF001

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("API_PORT", "8710"))
    data_dir = os.environ.get("DC_DATA_DIR", "")

    # 无控制台模式下把日志写入文件，便于排查启动失败
    if data_dir:
        log_dir = os.path.join(data_dir, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "api-server.log")
        logging.basicConfig(
            level=logging.WARNING,
            format="%(asctime)s %(levelname)s %(name)s: %(message)s",
            handlers=[logging.FileHandler(log_file, encoding="utf-8")],
        )

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )
